import type { Metadata } from "next";
import Link from "next/link";
import { categories } from "@/lib/format";
import { events, fees } from "@/lib/market";
import { CategoryNav, Empty, EventCard, SearchBar } from "../ui";

export const metadata: Metadata = { title: "Explore events" };

export default async function Explore({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const category = categories.find((item) => item === params.category) ?? "";
  const [catalogue, settings] = await Promise.all([events(search, category), fees()]);
  return <div className="shell page">
    <div className="page-heading"><h1>Explore events</h1><p>Concerts, festivals, sports and theatre across Malaysia.</p></div>
    <SearchBar search={search} category={category} />
    <CategoryNav active={category} search={search} />
    <div className="section-header"><div><h2>{category || "All events"}</h2><p>{catalogue.length} {catalogue.length === 1 ? "event" : "events"}{search ? ` matching “${search}”` : ""}</p></div></div>
    {catalogue.length ? <div className="event-grid">{catalogue.map((item) => <EventCard key={item.id} item={item} bps={settings.buyer_bps} />)}</div> :
      <Empty title="No events found"><Link className="button outline" href="/events">Clear filters</Link></Empty>}
  </div>;
}
