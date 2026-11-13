import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, PRODUCT_BY_KEY } from "@/lib/catalog";
import { getDataset } from "@/lib/data";
import { ago, dkk, due, shortDate } from "@/lib/format";
import { analyseAll } from "@/lib/scoring";
import AiPanel from "./AiPanel";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: { id: string } }) {
  const data = await getDataset();
  const i = analyseAll(data.clients).find((x) => x.client.id === Number(params.id));
  if (!i) notFound();
  const c = i.client;
  const nextKeys = i.offers.map((o) => o.product);

  return (
    <>
      <Link href="/" className="back">← All accounts</Link>
      <div className="row-flex" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>{c.name}</h1>
          <p className="sub">{[c.industry, c.city, `Rep: ${c.ownerName}`, `Client since ${shortDate(c.createdAt)}`].filter(Boolean).join(" · ")}</p>
        </div>
        <span className={`chip ${i.risk.level}`}>{i.risk.level} churn risk · {i.risk.score}</span>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="label">Lifetime spend</div><div className="value">{dkk(i.totalSpend)}</div><div className="hint">{i.orderCount} orders</div></div>
        <div className="kpi"><div className="label">Last order</div><div className="value">{ago(i.lastOrderDays)}</div><div className="hint">{i.avgIntervalDays ? `buys every ~${i.avgIntervalDays}d` : ""}</div></div>
        <div className="kpi"><div className="label">Last contact</div><div className="value">{ago(i.lastContactDays)}</div></div>
        <div className="kpi"><div className="label">Contact</div><div className="value">{due(i.contact.dueInDays)}</div><div className="hint">{i.contact.reason}</div></div>
      </div>

      <AiPanel clientId={c.id} defaultLang={c.country === "DE" || c.country === "AT" ? "de" : c.country === "DK" ? "da" : "en"} />
      <div className="space" />

      <div className="card">
        <h2>Products</h2>
        <div className="products">
          {PRODUCTS.map((p) => (
            <div key={p.key} className={`prod ${i.owned.includes(p.key) ? "owned" : nextKeys.includes(p.key) ? "next" : ""}`}>
              {i.owned.includes(p.key) ? "✓ " : nextKeys.includes(p.key) ? "→ " : ""}{p.name}
              <small>{i.owned.includes(p.key) ? "Owned" : nextKeys.includes(p.key) ? "Recommended next" : "Not bought"}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="space" />

      <div className="grid2">
        <div className="card">
          <h2>Next best offers</h2>
          {i.offers.length ? i.offers.map((o) => (
            <div key={o.product + o.reasons[0]} style={{ marginBottom: 12 }}>
              <b>{PRODUCT_BY_KEY[o.product].name}</b> <span className="muted">· est. {dkk(o.estValue)}</span>
              <ul className="reasons">{o.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )) : <p className="muted">They already own the natural next products.</p>}
        </div>
        <div className="card">
          <h2>Why this churn score</h2>
          <ul className="reasons">{i.risk.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      </div>
      <div className="space" />

      <div className="grid2">
        <div className="card">
          <h2>Purchases</h2>
          <ul className="timeline">
            {[...c.orders].reverse().map((o) => (
              <li key={o.id}><span className="when">{shortDate(o.date)}</span><span>{o.label}</span><b>{dkk(o.value)}</b></li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Contact history</h2>
          {c.activities.length ? (
            <ul className="timeline">
              {c.activities.map((a) => (
                <li key={a.id}><span className="when">{shortDate(a.date)}</span><span>{a.description || "—"}</span><span className="muted">{a.type}</span></li>
              ))}
            </ul>
          ) : <p className="muted">No activities logged.</p>}
        </div>
      </div>
    </>
  );
}
