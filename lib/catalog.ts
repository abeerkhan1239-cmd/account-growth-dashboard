// ISA's own titles as they appear in webCRM (DeliveryProduct "ISA - …", or —
// when no product was chosen — the quotation lines' title/format columns).
// typicalValue (DKK) and cycleDays are illustrative defaults: typicalValue is only
// used to estimate upsell value, and cycleDays is replaced per client by their own
// order rhythm once they have 2+ orders. Tune both to your own price list.

export type ProductKey =
  | "hallonabo"
  | "hn_premium"
  | "hn_digital"
  | "impact"
  | "impact_digital"
  | "ditmagasin"
  | "creative"
  | "digital"
  | "sommer";

export type Product = {
  key: ProductKey;
  name: string;
  short: string;
  pitch: string; // one-line value statement used in pitches and templates
  typicalValue: number; // DKK
  cycleDays: number;
};

export const PRODUCTS: Product[] = [
  { key: "hallonabo", name: "Hallo Nabo (print)", short: "Hallo Nabo", pitch: "an ad in Hallo Nabo, the magazine that reaches German and Danish holiday guests and neighbours in the border region", typicalValue: 15000, cycleDays: 180 },
  { key: "hn_premium", name: "Hallo Nabo Premium Listing", short: "HN Premium", pitch: "a Premium Listing in Hallo Nabo so the business stands out every time readers look for where to go", typicalValue: 5000, cycleDays: 365 },
  { key: "hn_digital", name: "Hallo Nabo Digital", short: "HN Digital", pitch: "Hallo Nabo's digital package, which carries the print ad online to reach guests before and during their trip", typicalValue: 10000, cycleDays: 120 },
  { key: "impact", name: "Impact (print)", short: "Impact", pitch: "an ad in Impact, ISA's business magazine distributed with Berlingske", typicalValue: 20000, cycleDays: 180 },
  { key: "impact_digital", name: "Impact Digital", short: "Impact Dig.", pitch: "Impact's digital extension (e-paper and product display) that keeps the story visible after the print issue", typicalValue: 5000, cycleDays: 120 },
  { key: "ditmagasin", name: "Dit Magasin", short: "Dit Magasin", pitch: "a placement in Dit Magasin", typicalValue: 8000, cycleDays: 180 },
  { key: "creative", name: "ISA Creative", short: "Creative", pitch: "ISA Creative producing the ad, video or content so the campaign looks its best", typicalValue: 3000, cycleDays: 365 },
  { key: "digital", name: "ISA Digital / SoMe", short: "Digital", pitch: "an ISA Digital or social media campaign that adds reach on Facebook and Instagram", typicalValue: 6000, cycleDays: 90 },
  { key: "sommer", name: "Sommer i Danmark", short: "Sommer", pitch: "a placement in Sommer i Danmark ahead of the summer season", typicalValue: 7500, cycleDays: 365 },
];

export const PRODUCT_BY_KEY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p])) as Record<ProductKey, Product>;

/** Expert rules: "if they bought A, B is the natural next step" (weight 0–1). */
export const NEXT_STEP_RULES: Record<ProductKey, Partial<Record<ProductKey, number>>> = {
  hallonabo: { hn_digital: 0.9, hn_premium: 0.8, impact: 0.3 },
  hn_premium: { hn_digital: 0.7, hallonabo: 0.6 },
  hn_digital: { hallonabo: 0.7, hn_premium: 0.5 },
  impact: { impact_digital: 0.9, hallonabo: 0.3, creative: 0.3 },
  impact_digital: { impact: 0.7 },
  ditmagasin: { hallonabo: 0.5, digital: 0.5 },
  creative: { digital: 0.6, hallonabo: 0.3 },
  digital: { creative: 0.4, hallonabo: 0.4 },
  sommer: { hallonabo: 0.6, digital: 0.4 },
};

const isDigitalFormat = (s: string) => /digital|display|viewing|e-avis|online|some/.test(s);

/**
 * Map a webCRM order onto an ISA title.
 * product: DeliveryProduct; lines: [title, format] from QuotationLineData1/Data2.
 */
export function matchProduct(product: string | null | undefined, lines: [string, string][] = []): ProductKey | null {
  const p = (product || "").toLowerCase();
  if (p.startsWith("isa")) {
    if (p.includes("premium")) return "hn_premium";
    if (p.includes("hallo nabo") && p.includes("digital")) return "hn_digital";
    if (p.includes("impact") && p.includes("digital")) return "impact_digital";
    if (p.includes("hallo nabo")) return "hallonabo";
    if (p.includes("impact")) return "impact";
    if (p.includes("dit magasin")) return "ditmagasin";
    if (p.includes("creative")) return "creative";
    if (p.includes("sommer")) return "sommer";
    if (p.includes("digital") || p.includes("some")) return "digital";
  }
  // No (ISA) product chosen on the order: read the quotation lines.
  for (const [t, f] of lines) {
    const title = (t || "").toLowerCase();
    const fmt = (f || "").toLowerCase();
    if (title.includes("hallo nabo")) return isDigitalFormat(fmt) ? "hn_digital" : "hallonabo";
    if (title.includes("impact")) return isDigitalFormat(fmt) || isDigitalFormat(title) ? "impact_digital" : "impact";
  }
  return null;
}
