import Anthropic from "@anthropic-ai/sdk";
import { PRODUCT_BY_KEY } from "@/lib/catalog";
import { getDataset } from "@/lib/data";
import { dkk, shortDate } from "@/lib/format";
import { analyseAll, type Insight } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type Kind = "explain" | "email" | "call";
type Lang = "da" | "de" | "en";

const SYSTEM = `You help sales reps at ISA Media Group (Denmark) grow and keep the advertisers who buy ISA's own titles — mainly the Hallo Nabo magazine (Danish/German border region and holiday guests) and Impact. Many clients are German, many are Danish.
You get one client's account data from the CRM plus a computed churn score, next best offers and contact plan.
Rules:
- Use only facts from the account data. Never invent results, numbers, prices, discounts or promises.
- Write like a friendly, direct local sales rep — short sentences, no marketing fluff, no emojis.
- Danish output must be natural Danish (du-form); German output natural business German (Sie-form); never translated-sounding English.
- Output plain text, no markdown headings.`;

function brief(i: Insight): string {
  const c = i.client;
  return [
    `Client: ${c.name} (${c.industry || "unknown sector"}, ${c.city || "unknown city"})`,
    `Rep: ${c.ownerName}. Client since ${shortDate(c.createdAt)}.`,
    `Products owned: ${i.owned.map((k) => PRODUCT_BY_KEY[k].name).join(", ") || "none mapped"}`,
    `Lifetime spend: ${dkk(i.totalSpend)} over ${i.orderCount} orders. Usual rhythm: ${i.avgIntervalDays ? `~${i.avgIntervalDays} days` : "unknown"}.`,
    `Orders (newest first):`,
    ...[...c.orders].reverse().slice(0, 10).map((o) => `- ${shortDate(o.date)}: ${o.label}, ${dkk(o.value)}`),
    `Recent contact (newest first):`,
    ...(c.activities.length ? c.activities.slice(0, 6).map((a) => `- ${shortDate(a.date)} ${a.type}: ${a.description}`) : ["- none logged"]),
    `Churn risk: ${i.risk.score}/100 (${i.risk.level}). Reasons: ${i.risk.reasons.join("; ")}`,
    `Next best offers: ${i.offers.map((o) => `${PRODUCT_BY_KEY[o.product].name} — what it is: ${PRODUCT_BY_KEY[o.product].pitch}; why: ${o.reasons.join("; ")}`).join(" | ") || "none"}`,
    `Contact plan: ${i.contact.reason} (${i.contact.kind}).`,
  ].join("\n");
}

function task(kind: Kind, lang: Lang): string {
  const l = lang === "da" ? "Write in Danish." : lang === "de" ? "Write in German." : "Write in English.";
  if (kind === "explain")
    return `In 3 short bullet points (start each with "• "), tell the rep why this account needs attention now and what the single best move is. Then one line starting "Opener:" with a first sentence to say on the phone. ${l}`;
  if (kind === "email")
    return `Write a short email (max 120 words) from the rep to the client: subject line first ("Subject:" / "Emne:" / "Betreff:"), then the body. Goal: ${"reconnect, ask how things are going and suggest a short call about the recommended next product"}. Signed with the rep's first name. ${l}`;
  return `Write a phone call script: opener, 2–3 questions about how business is going, a short pitch for the top recommended product tied to what they already bought, one likely objection with an answer, and a clear next step. Keep it under 180 words. ${l}`;
}

/** Two distinct "why now" bullets: the top risk reason, then the contact reason or the next risk reason. */
function whyBullets(i: Insight): string {
  const second = i.contact.kind === "win-back" ? i.risk.reasons[1] : i.contact.reason;
  return [i.risk.reasons[0], second].filter(Boolean).map((r) => `• ${r}`).join("\n");
}

/** Used when no Anthropic credentials are configured or the API call fails. */
function template(kind: Kind, lang: Lang, i: Insight): string {
  const first = i.client.ownerName.split(" ")[0];
  const offer = i.offers[0] ? PRODUCT_BY_KEY[i.offers[0].product] : null;
  const last = i.client.orders[i.client.orders.length - 1];
  if (lang === "da") {
    if (kind === "explain")
      return `${whyBullets(i)}\n• Bedste træk: ${offer ? `foreslå ${offer.name}` : "ring og hør, hvordan det går"}\nOpener: "Hej, det er ${first} fra Hallo Nabo — jeg ville lige høre, hvordan det er gået siden ${last?.label ?? "sidst"}?"`;
    if (kind === "email")
      return `Emne: Hvordan går det hos ${i.client.name}?\n\nHej,\n\nDet er et stykke tid siden, vi sidst talte sammen, og jeg ville gerne høre, hvordan det er gået siden ${last?.label ?? "jeres seneste kampagne"}.\n\n${offer ? `Jeg har en idé til, hvordan ${offer.pitch} kunne passe godt til jer lige nu. ` : ""}Har du 10 minutter til et kort opkald i næste uge?\n\nVenlig hilsen\n${first}`;
    return `Opener: "Hej, det er ${first} fra Hallo Nabo. Har du to minutter?"\nSpørgsmål: Hvordan har travlheden været? Fik I nye kunder ud af ${last?.label ?? "sidste kampagne"}?\nPitch: ${offer ? `Mange i jeres situation tager næste skridt med ${offer.name} — ${offer.pitch}.` : "Hør, om de har planer for den kommende sæson."}\nIndvending "Det er for dyrt": Vi kan starte småt og se resultater, før I bestemmer jer.\nNæste skridt: Book et kort møde eller send et tilbud i dag.`;
  }
  if (lang === "de") {
    if (kind === "explain")
      return `${whyBullets(i)}\n• Bester Schritt: ${offer ? `${offer.name} anbieten` : "anrufen und nachfragen, wie es läuft"}\nOpener: "Guten Tag, hier ist ${first} von Hallo Nabo — ich wollte hören, wie es seit ${last?.label ?? "Ihrer letzten Anzeige"} gelaufen ist."`;
    if (kind === "email")
      return `Betreff: Wie läuft es bei ${i.client.name}?\n\nGuten Tag,\n\nes ist eine Weile her, seit wir zuletzt gesprochen haben, und ich wollte hören, wie es seit ${last?.label ?? "Ihrer letzten Anzeige"} gelaufen ist.\n\n${offer ? `Ich habe eine Idee, wie ${offer.pitch} gut zu Ihnen passen könnte. ` : ""}Hätten Sie nächste Woche 10 Minuten für ein kurzes Telefonat?\n\nMit freundlichen Grüßen\n${first}`;
    return `Opener: "Guten Tag, hier ist ${first} von Hallo Nabo. Haben Sie zwei Minuten?"\nFragen: Wie war die Saison bisher? Haben Sie Rückmeldungen auf ${last?.label ?? "die letzte Anzeige"} bekommen?\nPitch: ${offer ? `Viele Betriebe wie Ihrer gehen den nächsten Schritt mit ${offer.name} — ${offer.pitch}.` : "Nach Plänen für die kommende Saison fragen."}\nEinwand "Zu teuer": Wir können klein anfangen und Ergebnisse zeigen, bevor Sie mehr buchen.\nNächster Schritt: Kurzen Termin vereinbaren oder heute ein Angebot schicken.`;
  }
  if (kind === "explain")
    return `${whyBullets(i)}\n• Best move: ${offer ? `pitch ${offer.name}` : "call and ask how things are going"}\nOpener: "Hi, it's ${first} from Hallo Nabo — I wanted to hear how things have gone since ${last?.label ?? "last time"}."`;
  if (kind === "email")
    return `Subject: How are things at ${i.client.name}?\n\nHi,\n\nIt's been a while since we last spoke, and I wanted to hear how things have gone since ${last?.label ?? "your last campaign"}.\n\n${offer ? `I have an idea for how ${offer.pitch} could fit you right now. ` : ""}Do you have 10 minutes for a short call next week?\n\nBest,\n${first}`;
  return `Opener: "Hi, it's ${first} from Hallo Nabo. Got two minutes?"\nQuestions: How busy has it been? Did you get new customers from ${last?.label ?? "the last campaign"}?\nPitch: ${offer ? `Many businesses like yours take the next step with ${offer.name} — ${offer.pitch}.` : "Ask about their plans for the coming season."}\nObjection "It's too expensive": We can start small and show results before you commit.\nNext step: Book a short meeting or send an offer today.`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind: Kind = ["explain", "email", "call"].includes(body.kind) ? body.kind : "explain";
  const lang: Lang = body.lang === "en" || body.lang === "de" ? body.lang : "da";
  const data = await getDataset();
  const insight = analyseAll(data.clients).find((x) => x.client.id === Number(body.clientId));
  if (!insight) return Response.json({ error: "Client not found" }, { status: 404 });

  try {
    const client = new Anthropic();
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `ACCOUNT DATA\n${brief(insight)}\n\nTASK\n${task(kind, lang)}` }],
    });
    if (msg.stop_reason === "refusal") throw new Error("refusal");
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (!text) throw new Error("empty response");
    return Response.json({ text, source: "ai" });
  } catch (err) {
    return Response.json({
      text: template(kind, lang, insight),
      source: "template",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}
