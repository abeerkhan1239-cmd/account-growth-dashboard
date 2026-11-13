# Account Growth: an AI sales dashboard on webCRM

A dashboard for a media sales team that answers three questions about every advertiser:

1. **What should we sell them next?** Next-best offer from product rules plus "clients who bought A also bought B" learned from the CRM itself.
2. **When should we contact them?** Follow-up dates, post-campaign check-ins, rebook windows from each client's own buying rhythm, and win-backs.
3. **How likely are they to leave?** An explainable churn score (overdue vs. rhythm, contact gaps, one-off buyers, shrinking orders, negative notes).

Every score shows its reasons in plain language, so reps can trust it or argue with it. An AI assistant (Claude) drafts the "why now" summary, a follow-up email or a call script in **Danish, German or English**, and reps rate each suggestion 1–5 so quality is measured, not assumed.

> Built for the sales team selling ISA Media Group's own titles (Hallo Nabo, Impact). This public version runs on **invented sample data**. No real client data is in this repository.

## Screens

- **Today's calls:** the top 12 accounts to contact, ranked by churn risk × upsell value × account size, each with the reason and the pitch.
- **All accounts:** a sortable book with products owned, spend, last order, last contact, churn score and next offer.
- **Rebook radar:** who is overdue, and who is due in the next 30, 60 and 90 days.
- **Client page:** products owned vs. recommended, offers with reasons, churn breakdown, purchase and contact timeline, AI assistant.
- **Feedback:** average rating and rating count per suggestion type (the adoption numbers).

## How it works

```
webCRM REST API ──(4 slim /Queries + users)──▶ lib/webcrm.ts ──▶ normalised clients/orders/activities
                                                                   │
                         lib/catalog.ts (titles, next-step rules) ─┤
                                                                   ▼
                                   lib/scoring.ts: churn risk · next best offer · contact plan · priority
                                                                   │
                       Next.js pages (Today / All / Radar / Client) + /api/ai (Claude) + /api/feedback
```

Engineering notes:
- **Fast sync on a large CRM.** webCRM's paged entity endpoints return every field (several KB per record). The app uses webCRM's SQL-like `/Queries` endpoint to pull only the clients and fields it needs, so a sync takes seconds instead of hours. It respects the 250 req/min rate limit (`RetryAfterSeconds`) and caches results for 10 minutes.
- **Messy data handled.** Orders with no product chosen are mapped to a title from their quotation lines. Placeholder activity dates in the far future are ignored.
- **Read-only.** The app only issues GET queries. Nothing is ever written to the CRM and no email is sent automatically.
- **Fails closed.** In live mode the app refuses to serve anything unless `DASHBOARD_PASSWORD` is set.
- **AI with a safe fallback.** It uses `claude-opus-5-5` with server-side refusal fallback. Without an API key, deterministic templates are used instead.

## Run it

```bash
npm install
cp .env.example .env.local   # leave WEBCRM_TOKEN empty for sample data
npm run dev                  # http://localhost:4500
```

| Variable | Purpose |
|---|---|
| `WEBCRM_TOKEN` | webCRM **read-only** REST application token. Empty → sample data. |
| `DASHBOARD_PASSWORD` | Required in live mode (basic-auth prompt, any username). |
| `ANTHROPIC_API_KEY` | Enables AI drafts. Empty → built-in templates. |
| `HISTORY_DAYS` | Order history used for scoring (default 365). |

Ratings are stored in `data/feedback.json`. On serverless hosts (e.g. Vercel) the filesystem is read-only, so swap `lib/feedback.ts` for a KV store there.

## Stack

Next.js 14 · TypeScript · webCRM REST API · Claude API (`@anthropic-ai/sdk`) · built with Claude Code.
