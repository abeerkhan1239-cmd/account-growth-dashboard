import { getDataset } from "@/lib/data";
import { analyseAll } from "@/lib/scoring";
import AccountsView, { type Row } from "./AccountsView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDataset();
  const insights = analyseAll(data.clients);

  // Send the browser only what the list views need, not full CRM histories.
  const rows: Row[] = insights.map((i) => ({
    id: i.client.id,
    name: i.client.name,
    industry: i.client.industry,
    city: i.client.city,
    ownerId: i.client.ownerId,
    ownerName: i.client.ownerName,
    owned: i.owned,
    totalSpend: i.totalSpend,
    orderCount: i.orderCount,
    lastOrderDays: i.lastOrderDays,
    lastContactDays: i.lastContactDays,
    expectedNextOrderInDays: i.expectedNextOrderInDays,
    risk: i.risk,
    offer: i.offers[0] ?? null,
    contact: i.contact,
    priority: i.priority,
  }));

  return <AccountsView rows={rows} reps={data.reps} mode={data.mode} error={data.error} fetchedAt={data.fetchedAt} />;
}
