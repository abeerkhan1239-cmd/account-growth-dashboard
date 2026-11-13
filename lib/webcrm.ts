// Read-only webCRM client (spec: https://api.webcrm.com/swagger/v1/swagger.json).
//
// A webCRM instance can hold hundreds of thousands of records, so instead of the
// paged entity endpoints (several KB per record) we use GET /Queries with
// slim SQL-like scripts that return only ISA-title clients and the fields we
// use. A full sync is 4 queries + 1 user lookup and takes a few seconds.
//
// Auth: POST /Auth/ApiLogin with the application token as `authCode`
// (form-urlencoded) -> short-lived JWT, sent as `Authorization: Bearer`.
// Rate limit: 250 requests/minute; a 429 carries RetryAfterSeconds.

import { matchProduct } from "./catalog";
import type { Activity, Client, Dataset, Order } from "./types";

const BASE = process.env.WEBCRM_BASE_URL || "https://api.webcrm.com";
const HISTORY_DAYS = Number(process.env.HISTORY_DAYS) || 365;
const QUERY_PAGE = 10000; // max page size for /Queries
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value;
  const res = await fetch(`${BASE}/Auth/ApiLogin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ authCode: process.env.WEBCRM_TOKEN ?? "" }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.IsError || !body.AccessToken) {
    throw new Error(`webCRM login failed (${res.status}): ${body.ErrorDescription || body.Error || "no access token"}`);
  }
  token = { value: body.AccessToken, expiresAt: Date.now() + (Number(body.ExpiresIn) || 3600) * 1000 };
  return token.value;
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await accessToken()}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) return res.json() as Promise<T>;
    if (res.status === 401 && attempt === 0) {
      token = null; // expired access token: log in again once
      continue;
    }
    if (res.status === 429 && attempt < 4) {
      const body = await res.json().catch(() => ({}));
      const wait = Number(body.RetryAfterSeconds) || Number(res.headers.get("retry-after")) || 15;
      console.log(`[webcrm] throttled on ${path}, waiting ${wait}s`);
      await sleep(Math.min(wait, 65) * 1000 + 500);
      continue;
    }
    const detail = await res.text().catch(() => "");
    throw new Error(`webCRM GET ${path} failed (${res.status}) ${detail.slice(0, 160)}`);
  }
}

type Row = Record<string, unknown>;

async function query(script: string): Promise<Row[]> {
  const all: Row[] = [];
  for (let page = 1; page <= 50; page++) {
    const batch = await get<Row[]>("/Queries", { script, Page: page, Size: QUERY_PAGE });
    all.push(...batch);
    if (batch.length < QUERY_PAGE) break;
  }
  return all;
}

const iso = (d: unknown) => {
  if (typeof d !== "string" || !d || d.startsWith("0001")) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
};
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const num = (v: unknown) => Number(v) || 0;

type UserDto = { UserId: number; UserName?: string; UserEmail?: string };

export async function fetchWebcrm(): Promise<Dataset> {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const since = day(-HISTORY_DAYS);
  const today = day(1);

  // An order counts as ISA when its product is an ISA title, or when no product
  // was chosen but a quotation line names Hallo Nabo / Impact.
  const isaOrders = `DeliveryOrderDate >= '${since}' and (DeliveryProduct like 'ISA%' or DeliveryId in (select QuotationLineOpportunityId from QuotationLine where QuotationLineData1 like '%Hallo Nabo%' or QuotationLineData1 like '%Impact%'))`;
  const isaClients = `(select DeliveryOrganisationId from Delivery where ${isaOrders})`;

  const t0 = Date.now();
  const deliveries = await query(
    `select DeliveryId, DeliveryOrganisationId, DeliveryOrderDate, DeliveryOrderValue, DeliveryProduct, DeliveryStatus, DeliveryResponsible, DeliveryNextFollowUp from Delivery where ${isaOrders}`,
  );
  const lines = await query(
    `select QuotationLineOpportunityId, QuotationLineData1, QuotationLineData2 from QuotationLine where QuotationLineOpportunityId in (select DeliveryId from Delivery where ${isaOrders})`,
  );
  const orgs = await query(
    `select OrganisationId, OrganisationName, OrganisationIndustry, OrganisationCity, OrganisationCountry, OrganisationWww, OrganisationOwner, OrganisationCreatedAt, OrganisationLastActivityDate from Organisation where OrganisationId in ${isaClients}`,
  );
  // Some activities carry placeholder dates far in the future; cap at today.
  const activities = await query(
    `select ActivityId, ActivityOrganisationId, ActivityDateTime, ActivityType, ActivityDescription, ActivityStatus from Activity where ActivityDateTime >= '${since}' and ActivityDateTime <= '${today}' and ActivityOrganisationId in ${isaClients}`,
  );
  const users = await get<UserDto[]>("/Users/AllActive").catch(() => [] as UserDto[]);
  console.log(
    `[webcrm] synced ${orgs.length} clients, ${deliveries.length} orders, ${lines.length} quote lines, ${activities.length} activities in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );

  const userName = new Map(users.map((u) => [u.UserId, u.UserName || u.UserEmail || `User ${u.UserId}`]));
  const repName = (id: number) => (id ? userName.get(id) || `User ${id}` : "Unassigned");

  const linesByOrder = new Map<number, [string, string][]>();
  for (const l of lines) {
    const id = num(l.QuotationLineOpportunityId);
    const list = linesByOrder.get(id) ?? [];
    list.push([str(l.QuotationLineData1), str(l.QuotationLineData2)]);
    linesByOrder.set(id, list);
  }

  const ordersByOrg = new Map<number, (Order & { responsible: number })[]>();
  for (const d of deliveries) {
    const date = iso(d.DeliveryOrderDate);
    if (!date) continue;
    const id = num(d.DeliveryId);
    const ql = linesByOrder.get(id) ?? [];
    const product = matchProduct(str(d.DeliveryProduct), ql);
    const rawProduct = str(d.DeliveryProduct);
    const label = rawProduct.startsWith("ISA")
      ? rawProduct.replace(/^ISA - /, "")
      : ql.find(([t]) => /hallo nabo|impact/i.test(t))?.filter((x) => x && x !== "-").join(" · ") || "Order";
    const org = num(d.DeliveryOrganisationId);
    const list = ordersByOrg.get(org) ?? [];
    list.push({
      id,
      date,
      value: num(d.DeliveryOrderValue),
      product,
      label,
      status: str(d.DeliveryStatus),
      nextFollowUp: iso(d.DeliveryNextFollowUp),
      responsible: num(d.DeliveryResponsible),
    });
    ordersByOrg.set(org, list);
  }

  const actsByOrg = new Map<number, Activity[]>();
  for (const a of activities) {
    const date = iso(a.ActivityDateTime);
    if (!date) continue;
    const org = num(a.ActivityOrganisationId);
    const list = actsByOrg.get(org) ?? [];
    list.push({
      id: num(a.ActivityId),
      date,
      type: str(a.ActivityType) || "Activity",
      description: str(a.ActivityDescription),
      status: str(a.ActivityStatus),
    });
    actsByOrg.set(org, list);
  }

  const clients: Client[] = [];
  for (const o of orgs) {
    const id = num(o.OrganisationId);
    const orders = (ordersByOrg.get(id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (!orders.length) continue;
    // The rep on the newest order is who sells to them now; fall back to the org owner.
    const ownerId = [...orders].reverse().find((x) => x.responsible)?.responsible || num(o.OrganisationOwner);
    const industry = str(o.OrganisationIndustry);
    const lastAct = iso(o.OrganisationLastActivityDate);
    clients.push({
      id,
      name: str(o.OrganisationName) || `Organisation ${id}`,
      industry: industry === "Ikke bestemt" ? "" : industry,
      city: [str(o.OrganisationCity), str(o.OrganisationCountry)].filter(Boolean).join(", "),
      country: str(o.OrganisationCountry),
      website: str(o.OrganisationWww),
      ownerId,
      ownerName: repName(ownerId),
      createdAt: iso(o.OrganisationCreatedAt) || orders[0].date,
      lastActivityDate: lastAct && lastAct <= new Date().toISOString() ? lastAct : null,
      orders: orders.map(({ responsible: _r, ...rest }) => rest),
      activities: (actsByOrg.get(id) ?? []).sort((a, b) => b.date.localeCompare(a.date)),
    });
  }

  const repIds = Array.from(new Set(clients.map((c) => c.ownerId)));
  return {
    mode: "live",
    fetchedAt: new Date().toISOString(),
    clients,
    reps: repIds.map((id) => ({ id, name: repName(id) })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
