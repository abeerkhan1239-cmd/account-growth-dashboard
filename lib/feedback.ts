import { promises as fs } from "fs";
import path from "path";

// Ratings are appended to data/feedback.json. This works locally and on any
// server with a writable disk. Vercel's filesystem is read-only, so a Vercel
// deploy needs a store (e.g. Vercel KV / Upstash) swapped in here.
const FILE = path.join(process.cwd(), "data", "feedback.json");

export type Feedback = {
  at: string;
  clientId: number;
  kind: string;
  lang: string;
  rating: number; // 1–5
  source: string; // "ai" | "template"
};

export async function readFeedback(): Promise<Feedback[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function addFeedback(f: Feedback): Promise<void> {
  const all = await readFeedback();
  all.push(f);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}
