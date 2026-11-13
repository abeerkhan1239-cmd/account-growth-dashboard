"use client";

import { useState } from "react";

type Kind = "explain" | "email" | "call";
const LABEL: Record<Kind, string> = { explain: "Why now?", email: "Draft email", call: "Call script" };

type Lang = "da" | "de" | "en";

export default function AiPanel({ clientId, defaultLang }: { clientId: number; defaultLang: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [kind, setKind] = useState<Kind | null>(null);
  const [out, setOut] = useState<{ text: string; source: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(k: Kind) {
    setKind(k);
    setLoading(true);
    setOut(null);
    setRating(0);
    setSent(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, kind: k, lang }),
      });
      const j = await res.json();
      setOut({ text: j.text ?? j.error ?? "Something went wrong.", source: j.source ?? "error" });
    } catch {
      setOut({ text: "Couldn't reach the server.", source: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function rate(n: number) {
    setRating(n);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, kind, lang, rating: n, source: out?.source }),
      });
      setSent(true);
    } catch {}
  }

  async function copy() {
    if (!out) return;
    try {
      await navigator.clipboard.writeText(out.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="card">
      <div className="row-flex" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>AI assistant</h2>
        <div className="seg">
          <button className={lang === "da" ? "on" : ""} onClick={() => setLang("da")}>Dansk</button>
          <button className={lang === "de" ? "on" : ""} onClick={() => setLang("de")}>Deutsch</button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>English</button>
        </div>
      </div>
      <div className="space" />
      <div className="row-flex">
        {(Object.keys(LABEL) as Kind[]).map((k) => (
          <button key={k} className={`btn ${kind === k ? "" : "ghost"}`} disabled={loading} onClick={() => run(k)}>
            {LABEL[k]}
          </button>
        ))}
      </div>
      {loading && <div className="ai-out muted">Writing…</div>}
      {out && (
        <>
          <div className="ai-out">{out.text}</div>
          <div className="row-flex" style={{ marginTop: 10, justifyContent: "space-between" }}>
            <div className="row-flex">
              <span className="muted" style={{ fontSize: 13 }}>Was this useful?</span>
              <span className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={n <= rating ? "on" : ""} onClick={() => rate(n)} aria-label={`${n} stars`}>★</button>
                ))}
              </span>
              {sent && <span className="muted" style={{ fontSize: 13 }}>Thanks!</span>}
            </div>
            <div className="row-flex">
              {out.source === "template" && <span className="muted" style={{ fontSize: 12 }}>Template (no AI key)</span>}
              <button className="btn ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
        </>
      )}
      <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Drafts only — review and edit before sending. Nothing is sent automatically.</p>
    </div>
  );
}
