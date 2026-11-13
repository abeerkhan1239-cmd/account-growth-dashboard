import { addFeedback } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const rating = Math.round(Number(b.rating));
  if (!(rating >= 1 && rating <= 5)) return Response.json({ error: "rating must be 1–5" }, { status: 400 });
  try {
    await addFeedback({
      at: new Date().toISOString(),
      clientId: Number(b.clientId) || 0,
      kind: String(b.kind ?? "unknown").slice(0, 20),
      lang: b.lang === "en" || b.lang === "de" ? b.lang : "da",
      rating,
      source: b.source === "ai" ? "ai" : "template",
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
