"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PRODUCTS, PRODUCT_BY_KEY, type ProductKey } from "@/lib/catalog";
import { ago, dkk, due } from "@/lib/format";
import type { ContactPlan, Offer, Risk } from "@/lib/scoring";

export type Row = {
  id: number;
  name: string;
  industry: string;
  city: string;
  ownerId: number;
  ownerName: string;
  owned: ProductKey[];
  totalSpend: number;
  orderCount: number;
  lastOrderDays: number | null;
  lastContactDays: number | null;
  expectedNextOrderInDays: number | null;
  risk: Risk;
  offer: Offer | null;
  contact: ContactPlan;
  priority: number;
};

type Tab = "today" | "all" | "radar";
type SortKey = "name" | "risk" | "spend" | "lastOrder" | "lastContact" | "priority";

const KIND_LABEL: Record<ContactPlan["kind"], string> = {
  "follow-up": "Follow-up",
  "check-in": "Results check-in",
  rebook: "Rebook",
  "win-back": "Win-back",
  nurture: "Keep warm",
};

export default function AccountsView({
  rows,
  reps,
  mode,
  error,
  fetchedAt,
}: {
  rows: Row[];
  reps: { id: number; name: string }[];
  mode: "live" | "sample";
  error?: string;
  fetchedAt: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");
  const [rep, setRep] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "priority", dir: -1 });

  // Remember the rep filter per browser — reps mostly look at their own book.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hn-rep");
      if (saved) setRep(saved);
    } catch {}
  }, []);
  const chooseRep = (v: string) => {
    setRep(v);
    try {
      localStorage.setItem("hn-rep", v);
    } catch {}
  };

  const mine = useMemo(
    () =>
      rows.filter(
        (r) =>
          (rep === "all" || String(r.ownerId) === rep) &&
          (!q || `${r.name} ${r.industry} ${r.city}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, rep, q],
  );

  const dueAll = useMemo(() => mine.filter((r) => r.contact.dueInDays <= 0).sort((a, b) => b.priority - a.priority), [mine]);
  const today = dueAll.slice(0, 12); // a realistic day of calls; the rest stays in the backlog

  const sorted = useMemo(() => {
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case "name": return r.name;
        case "risk": return r.risk.score;
        case "spend": return r.totalSpend;
        case "lastOrder": return r.lastOrderDays ?? 99999;
        case "lastContact": return r.lastContactDays ?? 99999;
        default: return r.priority;
      }
    };
    return [...mine].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [mine, sort]);

  const kpi = useMemo(() => {
    const high = mine.filter((r) => r.risk.level === "high");
    return {
      accounts: mine.length,
      high: high.length,
      atRiskValue: high.reduce((s, r) => s + r.totalSpend, 0),
      dueToday: mine.filter((r) => r.contact.dueInDays <= 0).length,
      upsell: mine.reduce((s, r) => s + (r.offer?.estValue ?? 0), 0),
      rebook30: mine.filter((r) => r.expectedNextOrderInDays !== null && r.expectedNextOrderInDays <= 30).length,
    };
  }, [mine]);

  const radar = useMemo(() => {
    const buckets: { title: string; hint: string; items: Row[] }[] = [
      { title: "Overdue", hint: "past their usual rebook", items: [] },
      { title: "Next 30 days", hint: "", items: [] },
      { title: "31–60 days", hint: "", items: [] },
      { title: "61–90 days", hint: "", items: [] },
    ];
    for (const r of mine) {
      const d = r.expectedNextOrderInDays;
      if (d === null || d > 90) continue;
      buckets[d < 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3].items.push(r);
    }
    buckets.forEach((b) => b.items.sort((a, z) => (a.expectedNextOrderInDays ?? 0) - (z.expectedNextOrderInDays ?? 0)));
    return buckets;
  }, [mine]);

  const th = (key: SortKey, label: string) => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "name" ? 1 : -1 }))}>
      {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <>
      {mode === "sample" ? (
        <div className="banner">
          {error
            ? `Couldn't reach webCRM (${error}) — showing sample data.`
            : "Sample data — add WEBCRM_TOKEN to .env.local to load your real webCRM accounts."}
        </div>
      ) : (
        <div className="banner live">Live webCRM · clients who bought ISA titles in the last 12 months · synced {new Date(fetchedAt).toLocaleTimeString("en-GB")}</div>
      )}

      <h1>Account growth</h1>
      <p className="sub">What to sell next, when to call, and who might leave.</p>

      <div className="kpis">
        <div className="kpi"><div className="label">Accounts</div><div className="value">{kpi.accounts}</div><div className="hint">clients who have bought</div></div>
        <div className="kpi"><div className="label">Contact backlog</div><div className="value">{kpi.dueToday}</div><div className="hint">due or overdue · top 12 shown today</div></div>
        <div className="kpi"><div className="label">High churn risk</div><div className="value" style={{ color: "var(--red)" }}>{kpi.high}</div><div className="hint">{dkk(kpi.atRiskValue)} lifetime spend</div></div>
        <div className="kpi"><div className="label">Upsell potential</div><div className="value">{dkk(kpi.upsell)}</div><div className="hint">top offer per account (est.)</div></div>
        <div className="kpi"><div className="label">Rebook ≤ 30 days</div><div className="value">{kpi.rebook30}</div><div className="hint">incl. overdue</div></div>
      </div>

      <div className="toolbar">
        <div className="seg">
          <button className={tab === "today" ? "on" : ""} onClick={() => setTab("today")}>Today’s calls</button>
          <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>All accounts</button>
          <button className={tab === "radar" ? "on" : ""} onClick={() => setTab("radar")}>Rebook radar</button>
        </div>
        <select value={rep} onChange={(e) => chooseRep(e.target.value)} aria-label="Sales rep">
          <option value="all">All reps</option>
          {reps.map((r) => (
            <option key={r.id} value={String(r.id)}>{r.name}</option>
          ))}
        </select>
        <input type="search" placeholder="Search client, sector, city" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {tab === "today" && today.length > 0 && (
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>
          Top {today.length} by priority (churn risk + upsell value + account size)
          {dueAll.length > today.length ? ` · ${dueAll.length - today.length} more in the backlog` : ""}
        </p>
      )}
      {tab === "today" && (
        today.length ? (
          <div className="calls">
            {today.map((r) => (
              <Link key={r.id} href={`/client/${r.id}`} className="call">
                <div className="top">
                  <div>
                    <div className="name">{r.name}</div>
                    <div className="meta">{[r.industry, r.city, r.ownerName].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className={`chip ${r.risk.level}`}>{r.risk.level} risk</span>
                </div>
                <div className="why">
                  <span className="chip kind">{KIND_LABEL[r.contact.kind]}</span> {r.contact.reason}
                </div>
                {r.offer && (
                  <div className="offer">
                    Pitch: <b>{PRODUCT_BY_KEY[r.offer.product].name}</b> — {r.offer.reasons[0]}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="card muted">Nobody is due today for this filter. 🎉</div>
        )
      )}

      {tab === "all" && (
        <div className="tablecard">
          <table>
            <thead>
              <tr>
                {th("name", "Client")}
                <th>Products</th>
                {th("spend", "Spend")}
                {th("lastOrder", "Last order")}
                {th("lastContact", "Last contact")}
                {th("risk", "Churn risk")}
                <th>Next best offer</th>
                {th("priority", "Contact")}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="row" onClick={() => router.push(`/client/${r.id}`)}>
                  <td>
                    <Link href={`/client/${r.id}`}><b>{r.name}</b></Link>
                    <div className="muted" style={{ fontSize: 12 }}>{r.ownerName}</div>
                  </td>
                  <td>
                    <div className="pills">
                      {PRODUCTS.map((p) => (
                        <span key={p.key} className={`pill ${r.owned.includes(p.key) ? "on" : ""}`}>{p.short}</span>
                      ))}
                    </div>
                  </td>
                  <td>{dkk(r.totalSpend)}</td>
                  <td>{ago(r.lastOrderDays)}</td>
                  <td>{ago(r.lastContactDays)}</td>
                  <td><span className={`chip ${r.risk.level}`}>{r.risk.score}</span></td>
                  <td>{r.offer ? PRODUCT_BY_KEY[r.offer.product].name : <span className="muted">—</span>}</td>
                  <td>{due(r.contact.dueInDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "radar" && (
        <div className="radar">
          {radar.map((b) => (
            <div key={b.title} className="col">
              <h3>{b.title} <span className="muted">{b.items.length}</span></h3>
              {b.items.map((r) => (
                <Link key={r.id} href={`/client/${r.id}`} className="item">
                  {r.name}
                  <small>
                    {r.expectedNextOrderInDays! < 0 ? `${-r.expectedNextOrderInDays!}d overdue` : `in ~${r.expectedNextOrderInDays}d`}
                    {r.offer ? ` · pitch ${PRODUCT_BY_KEY[r.offer.product].short}` : ""}
                  </small>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
