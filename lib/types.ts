import type { ProductKey } from "./catalog";

export type Order = {
  id: number;
  date: string; // ISO
  value: number; // DKK
  product: ProductKey | null;
  label: string; // raw product/description text from the CRM
  status: string;
  nextFollowUp: string | null;
};

export type Activity = {
  id: number;
  date: string; // ISO
  type: string; // Call / Email / Meeting / Note ...
  description: string;
  status: string;
};

export type Client = {
  id: number;
  name: string;
  industry: string;
  city: string; // "City, CC"
  country: string; // ISO code, e.g. DK / DE — picks the default draft language
  website: string;
  ownerId: number;
  ownerName: string;
  createdAt: string;
  lastActivityDate: string | null; // from the organisation record, if any
  orders: Order[];
  activities: Activity[];
};

export type Dataset = {
  mode: "live" | "sample";
  fetchedAt: string;
  clients: Client[];
  reps: { id: number; name: string }[];
  error?: string; // set when live mode failed and we fell back to sample data
};
