import { sampleDataset } from "./sample";
import { fetchWebcrm } from "./webcrm";
import type { Dataset } from "./types";

// Live webCRM data when WEBCRM_TOKEN is set, otherwise sample data.
// Cached in memory so page loads don't hammer the CRM API (limit: 250 req/min).
const TTL_MS = 10 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000; // retry a failed live load after a minute
let cache: { at: number; ttl: number; data: Dataset } | null = null;
let inflight: Promise<Dataset> | null = null; // concurrent page loads share one sync

async function load(): Promise<Dataset> {
  if (!process.env.WEBCRM_TOKEN) return sampleDataset();
  try {
    return await fetchWebcrm();
  } catch (err) {
    return { ...sampleDataset(), error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getDataset(force = false): Promise<Dataset> {
  if (!force && cache && Date.now() - cache.at < cache.ttl) return cache.data;
  if (!inflight) {
    inflight = load()
      .then((data) => {
        cache = { at: Date.now(), ttl: data.error ? ERROR_TTL_MS : TTL_MS, data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
