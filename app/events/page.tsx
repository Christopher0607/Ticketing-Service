import type { Metadata } from "next";
import Link from "next/link";
import { categories } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { events, fees } from "@/lib/market";
import { CategoryNav, Empty, EventCard, SearchBar, categoryLabel } from "../ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t("events.title") };
}

export default async function Explore({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const category = categories.find((item) => item === params.category) ?? "";
  const [catalogue, settings, { t, f }] = await Promise.all([events(search, category), fees(), i18n()]);
  const count = catalogue.length === 1 ? t("events.count1") : t("events.count", { count: catalogue.length });
  return <div className="shell page">
    <div className="page-heading"><h1>{t("events.title")}</h1><p>{t("events.lead")}</p></div>
    <SearchBar t={t} search={search} category={category} />
    <CategoryNav t={t} active={category} search={search} />
    <div className="section-header"><div><h2>{categoryLabel(t, category)}</h2><p>{count}{search ? ` · ${t("events.matching", { q: search })}` : ""}</p></div></div>
    {catalogue.length ? <div className="event-grid">{catalogue.map((item) => <EventCard key={item.id} item={item} bps={settings.buyer_bps} t={t} f={f} />)}</div> :
      <Empty title={t("events.empty")}><Link className="button outline" href="/events">{t("events.clear")}</Link></Empty>}
  </div>;
}
