// Deterministic sample data shaped like normalised webCRM records.
// Dates are relative to "now" so the dashboard always looks current.
// Every business name here is invented.

import { PRODUCT_BY_KEY, type ProductKey } from "./catalog";
import type { Activity, Client, Dataset, Order } from "./types";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const REPS = [
  { id: 1, name: "Mikkel Sørensen" },
  { id: 2, name: "Sofie Lund" },
  { id: 3, name: "Jonas Holm" },
  { id: 4, name: "Freja Kjær" },
];

const BUSINESSES: [string, string, string][] = [
  ["Bageriet på Hjørnet", "Bageri", "Frederiksberg"],
  ["Frisør Lykke", "Frisør", "Valby"],
  ["Nørrebro Tandklinik", "Tandlæge", "Nørrebro"],
  ["Østerbro Fysioterapi", "Fysioterapi", "Østerbro"],
  ["Café Søen", "Restaurant", "Søborg"],
  ["Auto Hansen & Søn", "Autoværksted", "Glostrup"],
  ["VVS Kruse", "Håndværker", "Herlev"],
  ["Blomsterhuset Hellerup", "Butik", "Hellerup"],
  ["Trattoria Bella Vista", "Restaurant", "Vesterbro"],
  ["Klinik for Fodterapi", "Sundhed", "Lyngby"],
  ["Hjem & Bolig Mægleren", "Ejendomsmægler", "Gentofte"],
  ["Fit Zone Amager", "Fitness", "Amager"],
  ["Malerfirmaet Brix", "Håndværker", "Rødovre"],
  ["Optik Valby", "Butik", "Valby"],
  ["Sushi Nami", "Restaurant", "Østerbro"],
  ["Dyreklinikken Søborg", "Dyrlæge", "Søborg"],
  ["Elektriker Nord", "Håndværker", "Gladsaxe"],
  ["Skønhedsklinik Aura", "Skønhed", "Frederiksberg"],
  ["Cykelsmeden", "Butik", "Nørrebro"],
  ["Kiropraktor Holm", "Sundhed", "Hvidovre"],
  ["Pizzeria Napoli", "Restaurant", "Brønshøj"],
  ["Tømrer Jensen ApS", "Håndværker", "Ballerup"],
  ["Vinbaren Druen", "Restaurant", "Vesterbro"],
  ["Yoga Studio Ro", "Fitness", "Østerbro"],
  ["Advokathuset Lyngby", "Rådgivning", "Lyngby"],
  ["Tandlægerne i Brøndby", "Tandlæge", "Brøndby"],
  ["Børnetøj & Co", "Butik", "Frederiksberg"],
  ["Rengøring Plus", "Service", "Herlev"],
  ["Burger Shack", "Restaurant", "Amager"],
  ["Hudklinikken Vita", "Skønhed", "Gentofte"],
  ["Låsesmed 24", "Service", "Hvidovre"],
  ["Gårdbutikken Kildegaard", "Butik", "Dragør"],
  ["Psykolog Ane Berg", "Sundhed", "Valby"],
  ["Tagdækker Thomsen", "Håndværker", "Taastrup"],
  ["Bistro Hav", "Restaurant", "Nordhavn"],
  ["Personlig Træner Kim", "Fitness", "Vanløse"],
  ["Revisor Damgaard", "Rådgivning", "Ballerup"],
  ["Smykker by Line", "Butik", "Østerbro"],
  ["Hundeskolen Pote", "Service", "Brøndby"],
  ["Ostehjørnet", "Butik", "Vesterbro"],
];

// Purchase "journeys" give the sample realistic patterns for the scoring to find.
type Journey = { steps: ProductKey[]; repeat?: ProductKey; repeatTimes?: number };
const JOURNEYS: Journey[] = [
  { steps: ["hallonabo"], repeat: "hallonabo", repeatTimes: 1 },
  { steps: ["hallonabo", "hn_digital"] },
  { steps: ["impact"] },
  { steps: ["impact", "impact_digital"], repeat: "impact", repeatTimes: 1 },
  { steps: ["hallonabo", "hn_premium"] },
  { steps: ["hn_premium"] },
  { steps: ["ditmagasin"] },
  { steps: ["hallonabo", "creative"] },
  { steps: ["impact", "creative"] },
  { steps: ["sommer"] },
  { steps: ["hallonabo", "hn_digital", "hn_premium"] },
  { steps: ["digital", "creative"] },
];

const DAY = 86_400_000;

const CALL_NOTES = [
  "Ringede for opfølgning — glad for resultatet indtil videre.",
  "Kunden spurgte til priser på en ny kampagne.",
  "Talte om sæsonen; vil gerne høre om muligheder til foråret.",
  "Ingen svar, lagt besked.",
  "Kunden var utilfreds med antal henvendelser fra sidste kampagne.",
  "Sendte tilbud på næste pakke.",
  "Møde om resultater og næste skridt.",
];

export function sampleDataset(): Dataset {
  const r = rng(42);
  const now = Date.now();
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];

  let orderId = 1000;
  let actId = 5000;
  const clients: Client[] = BUSINESSES.map(([name, industry, city], i) => {
    const journey = JOURNEYS[i % JOURNEYS.length];
    const owner = REPS[i % REPS.length];
    const ageDays = 90 + Math.floor(r() * 270); // first order within the 12-month window
    const createdAt = now - ageDays * DAY;

    // Some clients have gone quiet: their history stops well before today.
    const quiet = r() < 0.3;
    const endOffset = quiet ? Math.min(ageDays - 10, 150 + Math.floor(r() * 120)) : Math.floor(r() * 45);
    const end = now - endOffset * DAY;

    const products: ProductKey[] = [...journey.steps];
    for (let k = 0; k < (journey.repeatTimes ?? 0); k++) if (journey.repeat) products.push(journey.repeat);
    const span = Math.max(30, end - createdAt);
    const orders: Order[] = products.map((p, k) => {
      const t = createdAt + (span * (k + 0.3 + r() * 0.4)) / products.length;
      const base = PRODUCT_BY_KEY[p].typicalValue;
      // Quiet clients order a bit less over time, so "declining value" shows up.
      const trend = quiet ? 1 - k * 0.08 : 1 + k * 0.03;
      return {
        id: orderId++,
        date: new Date(Math.min(t, end)).toISOString(),
        value: Math.round((base * (0.75 + r() * 0.5) * trend) / 100) * 100,
        product: p,
        label: PRODUCT_BY_KEY[p].name,
        status: "Won",
        nextFollowUp: null,
      };
    });
    orders.sort((a, b) => a.date.localeCompare(b.date));
    // A few open follow-ups set by reps in the CRM.
    if (r() < 0.2) orders[orders.length - 1].nextFollowUp = new Date(now + (Math.floor(r() * 10) - 3) * DAY).toISOString();

    const activities: Activity[] = [];
    const actCount = quiet ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 5);
    const lastContactGap = quiet ? 60 + Math.floor(r() * 120) : Math.floor(r() * 50);
    for (let k = 0; k < actCount; k++) {
      const t = now - (lastContactGap + k * (20 + Math.floor(r() * 40))) * DAY;
      if (t < createdAt) break;
      activities.push({
        id: actId++,
        date: new Date(t).toISOString(),
        type: pick(["Opkald", "Opkald", "E-mail", "Møde"]),
        description: pick(CALL_NOTES),
        status: "Udført",
      });
    }

    const country = i % 2 ? "DE" : "DK"; // mixed Danish/German book, like a border-region magazine
    return {
      id: 200 + i,
      name,
      industry,
      city: `${city}, ${country}`,
      country,
      website: "",
      ownerId: owner.id,
      ownerName: owner.name,
      createdAt: new Date(createdAt).toISOString(),
      lastActivityDate: activities[0]?.date ?? null,
      orders,
      activities,
    };
  });

  return { mode: "sample", fetchedAt: new Date().toISOString(), clients, reps: REPS };
}
