// ISA's own titles as they appear in webCRM (DeliveryProduct "ISA - …", or —
// when no product was chosen — the quotation lines' title/format columns).
// typicalValue (DKK) and cycleDays are illustrative defaults: typicalValue is only
// used to estimate upsell value, and cycleDays is replaced per client by their own
// order rhythm once they have 2+ orders. Tune both to your own price list.

export type ProductKey =
  | "hallonabo"
  | "hn_premium"
  | "hn_digital"
  | "business_listing"
  | "impact"
  | "impact_digital"
  | "ditmagasin"
  | "sommer"
  | "digital"
  | "landing"
  | "content"
  | "website"
  | "creative";

export type Product = {
  key: ProductKey;
  name: string;
  short: string;
  pitch: string; // one-line value statement used in pitches and templates
  typicalValue: number; // DKK
  cycleDays: number;
};

export const PRODUCTS: Product[] = [
  // Print titles
  { key: "hallonabo", name: "Hallo Nabo (print)", short: "Hallo Nabo", pitch: "an ad in Hallo Nabo, the magazine that reaches German and Danish holiday guests and neighbours in the border region", typicalValue: 15000, cycleDays: 180 },
  { key: "hn_premium", name: "Hallo Nabo Premium Listing", short: "HN Premium", pitch: "a Premium Listing in Hallo Nabo so the business stands out every time readers look for where to go", typicalValue: 5000, cycleDays: 365 },
  { key: "impact", name: "Impact (print)", short: "Impact", pitch: "an ad in Impact, ISA's business magazine distributed with Berlingske", typicalValue: 20000, cycleDays: 180 },
  { key: "ditmagasin", name: "Dit Magasin", short: "Dit Magasin", pitch: "a placement in Dit Magasin", typicalValue: 8000, cycleDays: 180 },
  { key: "sommer", name: "Sommer i Danmark", short: "Sommer", pitch: "a placement in Sommer i Danmark ahead of the summer season", typicalValue: 7500, cycleDays: 365 },
  // Digital offering
  { key: "hn_digital", name: "Hallo Nabo Digital (FB & IG)", short: "HN Digital", pitch: "Hallo Nabo's digital package, which carries the print ad to Facebook and Instagram to reach guests before and during their trip", typicalValue: 10000, cycleDays: 120 },
  { key: "business_listing", name: "Business Listing (Click / Boost)", short: "Listing", pitch: "a Hallo Nabo Business Listing with Click or Boost so the business is found online all season", typicalValue: 4000, cycleDays: 180 },
  { key: "impact_digital", name: "Impact Digital", short: "Impact Dig.", pitch: "Impact's digital extension (e-paper and product display) that keeps the story visible after the print issue", typicalValue: 5000, cycleDays: 120 },
  { key: "digital", name: "SoMe campaign (Meta)", short: "SoMe", pitch: "an ISA Digital social media campaign on Facebook and Instagram that adds targeted reach", typicalValue: 6000, cycleDays: 90 },
  { key: "landing", name: "Landing page", short: "Landing", pitch: "a landing page (hosted on hallonabo.dk / impact.dk or built by ISA Digital) that turns ad readers into leads and bookings", typicalValue: 8000, cycleDays: 365 },
  { key: "content", name: "Content creation", short: "Content", pitch: "ISA content creation: photos, video and posts the business can use across its channels", typicalValue: 5000, cycleDays: 180 },
  { key: "website", name: "Website (ISA Creative)", short: "Website", pitch: "a new or refreshed website built by ISA Creative", typicalValue: 25000, cycleDays: 730 },
  { key: "creative", name: "Ad production (ISA Creative)", short: "Creative", pitch: "ISA Creative producing the ad, video or content so the campaign looks its best", typicalValue: 3000, cycleDays: 365 },
];

/** Print vs. digital, for grouping in the UI. */
export const DIGITAL: ProductKey[] = ["hn_digital", "business_listing", "impact_digital", "digital", "landing", "content", "website", "creative"];

export const PRODUCT_BY_KEY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p])) as Record<ProductKey, Product>;

/** Expert rules: "if they bought A, B is the natural next step" (weight 0–1). */
export const NEXT_STEP_RULES: Record<ProductKey, Partial<Record<ProductKey, number>>> = {
  hallonabo: { hn_digital: 0.9, hn_premium: 0.8, landing: 0.5, business_listing: 0.5, impact: 0.3 },
  hn_premium: { hn_digital: 0.7, hallonabo: 0.6, business_listing: 0.5 },
  hn_digital: { landing: 0.7, hallonabo: 0.6, content: 0.4 },
  business_listing: { hn_digital: 0.6, landing: 0.5 },
  impact: { impact_digital: 0.9, landing: 0.5, creative: 0.3, hallonabo: 0.3 },
  impact_digital: { landing: 0.6, impact: 0.6 },
  ditmagasin: { hallonabo: 0.5, digital: 0.5 },
  sommer: { hallonabo: 0.6, digital: 0.4 },
  digital: { landing: 0.7, content: 0.6, creative: 0.4 },
  landing: { digital: 0.7, hn_digital: 0.5, content: 0.4 },
  content: { digital: 0.7, landing: 0.4 },
  website: { landing: 0.6, digital: 0.6, content: 0.5 },
  creative: { digital: 0.6, content: 0.5, website: 0.3 },
};

const isDigitalFormat = (s: string) => /digital|display|viewing|e-avis|online|some|facebook|instagram/.test(s);

/** What one webCRM order line (or the order's product field) is, if it is an ISA product. */
function matchText(text: string): ProductKey | null {
  const t = text.toLowerCase();
  // Specific digital services first: they appear under Hallo Nabo, Impact, ISA Digital and ISA Creative.
  if (/landing ?page|landingpage/.test(t)) return "landing";
  if (/website/.test(t)) return "website";
  if (/content creation/.test(t)) return "content";
  if (/business list(en|ing)/.test(t)) return "business_listing";
  if (/premium listing/.test(t)) return "hn_premium";
  if (/annonce ?produktion/.test(t)) return /hallo nabo|impact/.test(t) ? "creative" : null;
  if (/isa digital|meta platforms|special campaign some|^isa - digital$/.test(t)) return "digital";
  if (/hallo nabo/.test(t)) return isDigitalFormat(t) ? "hn_digital" : "hallonabo";
  if (/impact/.test(t)) return isDigitalFormat(t) ? "impact_digital" : "impact";
  if (/dit magasin/.test(t)) return "ditmagasin";
  if (/sommer i danmark/.test(t)) return "sommer";
  if (/isa creative|isa - creative/.test(t)) return "creative";
  return null;
}

/**
 * Map a webCRM order onto ISA products (print titles and digital services).
 * product: DeliveryProduct ("ISA - …" or a placeholder); lines: [title, format, placement]
 * from QuotationLineData1–3. Returns every ISA product in the order, main product first.
 */
export function matchProducts(product: string | null | undefined, lines: string[][] = []): ProductKey[] {
  const out: ProductKey[] = [];
  const add = (k: ProductKey | null) => k && !out.includes(k) && out.push(k);
  const p = (product || "").trim();
  if (/^isa/i.test(p)) add(matchText(p.replace(/^isa - digital \((hallo nabo|impact)\)/i, "$1 digital")));
  for (const l of lines) add(matchText(l.filter((x) => x && x !== "-").join(" | ")));
  return out;
}
