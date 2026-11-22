import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { categories } from "@/lib/format";
import { i18n, type MessageKey } from "@/lib/i18n";
import { cities, eventCount, events, fees, sortOptions, whenOptions } from "@/lib/market";
import { CategoryNav, Empty, EventCard, SearchBar, categoryLabel } from "@/app/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  return { title: t("events.title"), description: t("events.lead") };
}

const perPage = 24;
type Params = { q?: string; category?: string; city?: string; when?: string; sort?: string; page?: string };

export default async function Explore({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const category = categories.find((item) => item === params.category) ?? "";
  const when = whenOptions.find((item) => item === params.when) ?? "";
  const sort = sortOptions.find((item) => item === params.sort) ?? "date";
  const city = typeof params.city === "string" ? params.city.trim().slice(0, 80) : "";
  const page = Math.min(50, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const filters = { search, category, city, when, sort, page, limit: perPage };
  const [shown, total, places, settings, { t, f }] = await Promise.all([events(filters), eventCount(filters), cities(), fees(), i18n()]);
  const hasNext = page * perPage < total;
  const current: Record<string, string> = { q: search, category, city, when, sort: sort === "date" ? "" : sort };
  const href = (changes: Record<string, string>) => {
    const query = new URLSearchParams(Object.entries({ ...current, page: "", ...changes }).filter(([, value]) => value));
    return `/events${query.size ? `?${query}` : ""}`;
  };
  const filtered = Boolean(search || category || city || when);
  return <div className="shell page">
    <div className="page-heading"><h1>{t("events.title")}</h1><p>{t("events.lead")}</p></div>
    <SearchBar t={t} search={search} category={category} />
    <CategoryNav t={t} active={category} params={current} />
    <div className="filter-rows">
      <div className="filter-row"><span className="filter-label">{t("filter.when")}</span>
        {whenOptions.map((value) => <Link key={value || "all"} href={href({ when: value })} className={value === when ? "chip active" : "chip"} aria-current={value === when ? "true" : undefined}>
          {t(`when.${value || "all"}` as MessageKey)}</Link>)}
      </div>
      {places.length > 1 && <div className="filter-row"><span className="filter-label">{t("filter.city")}</span>
        <Link href={href({ city: "" })} className={!city ? "chip active" : "chip"}>{t("when.all")}</Link>
        {places.map((place) => <Link key={place.city} href={href({ city: place.city })} className={place.city.toLowerCase() === city.toLowerCase() ? "chip active" : "chip"}>{place.city}</Link>)}
      </div>}
    </div>
    <div className="section-header results-head">
      <div><h2>{categoryLabel(t, category)}{city && ` · ${city}`}</h2>
        <p>{total === 1 ? t("events.count1") : t("events.count", { count: total })}{search ? ` · ${t("events.matching", { q: search })}` : ""}</p></div>
      <div className="sort-links" aria-label={t("filter.sort")}>
        {sortOptions.map((value) => <Link key={value} href={href({ sort: value === "date" ? "" : value })} className={value === sort ? "active" : undefined} aria-current={value === sort ? "true" : undefined}>{t(`sort.${value}`)}</Link>)}
      </div>
    </div>
    {filtered && <Link href="/events" className="clear-filters"><X size={14} /> {t("events.clear")}</Link>}
    {shown.length ? <div className="event-grid">{shown.map((item) => <EventCard key={item.id} item={item} bps={settings.buyer_bps} t={t} f={f} />)}</div> :
      <Empty title={t("events.empty")}><Link className="button outline" href="/events">{t("events.clear")}</Link></Empty>}
    {(page > 1 || hasNext) && <nav className="pagination" aria-label={t("filter.pages")}>
      {page > 1 ? <Link className="button outline small" href={href({ page: page > 2 ? String(page - 1) : "" })}><ChevronLeft size={16} /> {t("filter.prev")}</Link> : <span />}
      <span className="page-number">{t("filter.page", { page })}</span>
      {hasNext ? <Link className="button outline small" href={href({ page: String(page + 1) })}>{t("filter.next")} <ChevronRight size={16} /></Link> : <span />}
    </nav>}
  </div>;
}
