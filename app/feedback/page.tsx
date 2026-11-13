import { readFeedback } from "@/lib/feedback";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { explain: "Why now?", email: "Draft email", call: "Call script" };

export default async function FeedbackPage() {
  const all = await readFeedback();
  const avg = (xs: { rating: number }[]) => (xs.length ? (xs.reduce((s, x) => s + x.rating, 0) / xs.length).toFixed(1) : "—");
  const weekAgo = Date.now() - 7 * 86_400_000;
  const kinds = Array.from(new Set(all.map((f) => f.kind)));

  return (
    <>
      <h1>Feedback</h1>
      <p className="sub">Ratings reps gave the AI suggestions. These are the numbers to quote — nothing here is estimated.</p>
      <div className="kpis">
        <div className="kpi"><div className="label">Average rating</div><div className="value">{avg(all)}<span className="muted" style={{ fontSize: 16 }}> / 5</span></div></div>
        <div className="kpi"><div className="label">Ratings</div><div className="value">{all.length}</div></div>
        <div className="kpi"><div className="label">Last 7 days</div><div className="value">{all.filter((f) => new Date(f.at).getTime() > weekAgo).length}</div></div>
        <div className="kpi"><div className="label">AI vs template</div><div className="value" style={{ fontSize: 18 }}>{avg(all.filter((f) => f.source === "ai"))} · {avg(all.filter((f) => f.source === "template"))}</div></div>
      </div>
      {kinds.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>By type</h2>
          <ul className="timeline">
            {kinds.map((k) => {
              const xs = all.filter((f) => f.kind === k);
              return <li key={k}><span className="when">{KIND[k] ?? k}</span><span>{xs.length} ratings</span><b>{avg(xs)}</b></li>;
            })}
          </ul>
        </div>
      )}
      <div className="card">
        <h2>Latest</h2>
        {all.length ? (
          <ul className="timeline">
            {[...all].reverse().slice(0, 30).map((f, i) => (
              <li key={i}><span className="when">{shortDate(f.at)}</span><span>{KIND[f.kind] ?? f.kind} · {f.lang.toUpperCase()} · client {f.clientId}</span><b>{"★".repeat(f.rating)}</b></li>
            ))}
          </ul>
        ) : <p className="muted">No ratings yet. Open a client, generate a suggestion, and rate it.</p>}
      </div>
    </>
  );
}
