// The three scores: next best offer, when to contact, churn risk.
// Every score carries plain-language reasons so reps can trust (and argue with) it.

import { NEXT_STEP_RULES, PRODUCTS, PRODUCT_BY_KEY, type ProductKey } from "./catalog";
import type { Client } from "./types";

const DAY = 86_400_000;
const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);

export type Offer = { product: ProductKey; score: number; reasons: string[]; estValue: number };
export type ContactPlan = {
  dueInDays: number; // 0 = today, negative = overdue
  date: string;
  reason: string;
  kind: "follow-up" | "check-in" | "rebook" | "win-back" | "nurture";
};
export type Risk = { score: number; level: "high" | "medium" | "low"; reasons: string[] };

export type Insight = {
  client: Client;
  owned: ProductKey[];
  totalSpend: number;
  orderCount: number;
  lastOrderDays: number | null;
  lastContactDays: number | null;
  avgIntervalDays: number | null;
  expectedNextOrderInDays: number | null; // negative = overdue
  risk: Risk;
  offers: Offer[];
  contact: ContactPlan;
  priority: number; // for the daily call list
};

/** Co-purchase stats across the whole book: P(B bought | A bought). */
export type CoStats = Map<ProductKey, Map<ProductKey, number>>;

export function coPurchaseStats(clients: Client[]): CoStats {
  const owners = new Map<ProductKey, number>();
  const pairs = new Map<string, number>();
  for (const c of clients) {
    const owned = Array.from(new Set(c.orders.map((o) => o.product).filter(Boolean))) as ProductKey[];
    for (const a of owned) {
      owners.set(a, (owners.get(a) ?? 0) + 1);
      for (const b of owned) if (a !== b) pairs.set(`${a}>${b}`, (pairs.get(`${a}>${b}`) ?? 0) + 1);
    }
  }
  const stats: CoStats = new Map();
  for (const [key, n] of Array.from(pairs.entries())) {
    const [a, b] = key.split(">") as [ProductKey, ProductKey];
    const base = owners.get(a) ?? 0;
    if (base < 3) continue; // too few clients to say anything
    if (!stats.has(a)) stats.set(a, new Map());
    stats.get(a)!.set(b, n / base);
  }
  return stats;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function analyse(client: Client, co: CoStats, now = Date.now()): Insight {
  const orders = client.orders;
  const owned = Array.from(new Set(orders.map((o) => o.product).filter(Boolean))) as ProductKey[];
  const totalSpend = orders.reduce((s, o) => s + o.value, 0);
  const lastOrder = orders.length ? new Date(orders[orders.length - 1].date).getTime() : null;
  const lastOrderDays = lastOrder ? daysBetween(lastOrder, now) : null;

  const contactDates = [
    ...client.activities.map((a) => new Date(a.date).getTime()),
    client.lastActivityDate ? new Date(client.lastActivityDate).getTime() : 0,
  ].filter((t) => t > 0 && t <= now);
  const lastContact = contactDates.length ? Math.max(...contactDates) : null;
  const lastContactDays = lastContact ? daysBetween(lastContact, now) : null;

  // Purchase rhythm: median gap between orders, else the typical cycle of what they bought last.
  const gaps: number[] = [];
  for (let i = 1; i < orders.length; i++)
    gaps.push(daysBetween(new Date(orders[i - 1].date).getTime(), new Date(orders[i].date).getTime()));
  const lastProduct = orders.length ? orders[orders.length - 1].product : null;
  const avgIntervalDays =
    median(gaps.filter((g) => g > 3)) ?? (lastProduct ? PRODUCT_BY_KEY[lastProduct].cycleDays : null);
  const expectedNextOrderInDays =
    lastOrderDays !== null && avgIntervalDays ? Math.round(avgIntervalDays - lastOrderDays) : null;

  // ---------- Churn risk ----------
  const reasons: string[] = [];
  let risk = 0;
  if (lastOrderDays !== null && avgIntervalDays) {
    const ratio = lastOrderDays / avgIntervalDays;
    if (ratio > 1.5) {
      risk += 35;
      reasons.push(`No order for ${lastOrderDays} days — normally they buy every ~${Math.round(avgIntervalDays)} days`);
    } else if (ratio > 1.1) {
      risk += 20;
      reasons.push(`Next order is overdue (${lastOrderDays} days since last, rhythm ~${Math.round(avgIntervalDays)})`);
    }
  }
  if (lastContactDays === null) {
    // Many reps don't log calls in webCRM, so missing activity is a weak signal.
    risk += 10;
    reasons.push("No contact logged in webCRM");
  } else if (lastContactDays > 90) {
    risk += 25;
    reasons.push(`No contact for ${lastContactDays} days`);
  } else if (lastContactDays > 60) {
    risk += 15;
    reasons.push(`Last contact ${lastContactDays} days ago`);
  } else if (lastContactDays > 30) {
    risk += 5;
  }
  if (orders.length === 1) {
    risk += 12;
    reasons.push("One-off buyer — has only ordered once");
  } else if (owned.length === 1) {
    risk += 8;
    reasons.push(`Only buys one product (${PRODUCT_BY_KEY[owned[0]].short})`);
  }
  if (orders.length >= 3) {
    const last = orders[orders.length - 1].value;
    const prev = orders.slice(0, -1).map((o) => o.value);
    const avgPrev = prev.reduce((s, v) => s + v, 0) / prev.length;
    if (avgPrev > 0 && last < avgPrev * 0.75) {
      risk += 15;
      reasons.push(`Last order was ${Math.round((1 - last / avgPrev) * 100)}% smaller than their average`);
    }
  }
  const negative = client.activities.slice(0, 3).find((a) => /utilfreds|unhappy|klage|complain|opsig|cancel|unzufrieden|kündig|beschwer|winback|win-back/i.test(a.description));
  if (negative) {
    risk += 15;
    reasons.push(`Recent note: “${negative.description.slice(0, 80)}”`);
  }
  risk = Math.min(100, risk);
  const level: Risk["level"] = risk >= 55 ? "high" : risk >= 30 ? "medium" : "low";
  if (!reasons.length) reasons.push("Buying and contact rhythm look healthy");

  // ---------- Next best offer ----------
  const offers: Offer[] = [];
  for (const p of PRODUCTS) {
    if (owned.includes(p.key)) continue;
    let score = 0;
    const why: string[] = [];
    for (const o of owned) {
      const rule = NEXT_STEP_RULES[o]?.[p.key];
      if (rule) {
        score += rule;
        why.push(`Natural next step after ${PRODUCT_BY_KEY[o].short}`);
      }
      const rate = co.get(o)?.get(p.key);
      if (rate && rate >= 0.25) {
        score += rate;
        why.push(`${Math.round(rate * 100)}% of ${PRODUCT_BY_KEY[o].short} clients also bought ${p.short}`);
      }
    }
    if (score > 0) offers.push({ product: p.key, score, reasons: Array.from(new Set(why)), estValue: p.typicalValue });
  }
  // Repeat buyer of the same title, booked issue by issue -> offer a series / annual booking.
  const counts = new Map<ProductKey, number>();
  for (const o of orders) if (o.product) counts.set(o.product, (counts.get(o.product) ?? 0) + 1);
  const repeat = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (repeat && repeat[1] >= 2) {
    offers.push({
      product: repeat[0],
      score: 0.75,
      reasons: [`Booked ${PRODUCT_BY_KEY[repeat[0]].short} ${repeat[1]} times one by one — offer a series booking for the next issues`],
      estValue: PRODUCT_BY_KEY[repeat[0]].typicalValue * 2,
    });
  }
  offers.sort((a, b) => b.score - a.score);

  // ---------- When to contact ----------
  const openFollowUp = orders
    .map((o) => o.nextFollowUp)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => a - b)[0];

  let contact: ContactPlan;
  const at = (inDays: number) => new Date(now + inDays * DAY).toISOString();
  const cooled = (d: number) => (lastContactDays !== null && lastContactDays < 7 ? Math.max(d, 7 - lastContactDays) : d);

  if (openFollowUp && daysBetween(now, openFollowUp) <= 14) {
    const d = daysBetween(now, openFollowUp);
    contact = { dueInDays: d, date: at(d), reason: "Follow-up date set in webCRM", kind: "follow-up" };
  } else if (level === "high") {
    const d = cooled(0);
    contact = { dueInDays: d, date: at(d), reason: `${reasons[0]} — call before they drift away`, kind: "win-back" };
  } else if (lastOrderDays !== null && lastOrderDays >= 14 && lastOrderDays <= 30) {
    const d = cooled(0);
    contact = {
      dueInDays: d,
      date: at(d),
      reason: `Their ${orders[orders.length - 1].label} ran ~${lastOrderDays} days ago — check in on results and pitch the next step`,
      kind: "check-in",
    };
  } else if (expectedNextOrderInDays !== null && expectedNextOrderInDays <= 21) {
    const d = cooled(Math.max(0, expectedNextOrderInDays - 14));
    contact = {
      dueInDays: d,
      date: at(d),
      reason:
        expectedNextOrderInDays < 0
          ? `Rebook is ${-expectedNextOrderInDays} days overdue based on their buying rhythm`
          : `Likely to rebook in ~${expectedNextOrderInDays} days — get in 2 weeks early`,
      kind: "rebook",
    };
  } else if (lastContactDays !== null && lastContactDays > 45) {
    const d = cooled(0);
    contact = { dueInDays: d, date: at(d), reason: `No contact for ${lastContactDays} days — keep the relationship warm`, kind: "nurture" };
  } else {
    const d = Math.max(7, (expectedNextOrderInDays ?? 60) - 14);
    contact = { dueInDays: d, date: at(d), reason: "Nothing urgent — next touchpoint ahead of their usual rebook", kind: "nurture" };
  }

  // Daily call list priority: urgency x (risk + opportunity), scaled by account size.
  const urgency = contact.dueInDays <= 0 ? 1 : contact.dueInDays <= 7 ? 0.5 : 0.1;
  const opportunity = offers[0] ? Math.min(1, offers[0].score) * 40 : 0;
  const sizeBoost = 1 + Math.min(1, totalSpend / 100_000);
  const priority = Math.round(urgency * (risk + opportunity) * sizeBoost);

  return {
    client,
    owned,
    totalSpend,
    orderCount: orders.length,
    lastOrderDays,
    lastContactDays,
    avgIntervalDays: avgIntervalDays ? Math.round(avgIntervalDays) : null,
    expectedNextOrderInDays,
    risk: { score: risk, level, reasons },
    offers: offers.slice(0, 3),
    contact,
    priority,
  };
}

export function analyseAll(clients: Client[]): Insight[] {
  const co = coPurchaseStats(clients);
  const now = Date.now();
  return clients.map((c) => analyse(c, co, now));
}
