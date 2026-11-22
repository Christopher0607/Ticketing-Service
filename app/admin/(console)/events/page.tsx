import Link from "next/link";
import { CalendarPlus, Pencil } from "lucide-react";
import { query } from "@/lib/db";
import { posterUrl } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { remoteFlags } from "@/lib/market";
import { closeEvent } from "@/app/actions";
import { Notice } from "@/app/ui";

export const metadata = { title: "Events" };

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [params, { t, f }] = await Promise.all([searchParams, i18n()]);
  const catalogue = await query<{ id: string; slug: string; title: string; venue: string; city: string; starts_at: Date; active: boolean; featured: boolean;
    image: string; poster_id: string | null; poster_remote: boolean | null; listings: number }>(`
    SELECT e.id,e.slug,e.title,e.venue,e.city,e.starts_at,e.active,e.featured,e.image,e.poster_id,${remoteFlags},
      (SELECT count(*)::int FROM listings l WHERE l.event_id=e.id AND l.status='active') AS listings
    FROM events e ORDER BY e.starts_at DESC LIMIT 200`);
  return <>
    <div className="page-heading heading-split"><div><h1>{t("admin.tab.events")}</h1><p>{t("admin.publishLead")}</p></div>
      <Link className="button primary" href="/admin/events/new"><CalendarPlus size={17} /> {t("admin.publish")}</Link></div>
    <Notice t={t} error={params.error} success={params.success} />
    <section className="panel admin-panel">
      {!catalogue.length && <p className="muted">{t("admin.noEvents")}</p>}
      {catalogue.map((item) => <div className="admin-row event-admin-row" key={item.id}>
        <span className="row-thumb"><img src={posterUrl(item)} alt="" /></span>
        <div><strong>{item.active ? <Link className="text-link" href={`/events/${item.slug}`}>{item.title}</Link> : item.title}
          {!item.active && <span className="status status-paused">{t("admin.hidden")}</span>}{item.featured && <span className="status status-active">{t("home.featured")}</span>}</strong>
          <p>{f.date(item.starts_at)} · {item.venue}, {item.city} · {t("console.liveListings", { count: item.listings })}</p></div>
        <div className="inline-form"><Link className="button outline small" href={`/admin/events/${item.id}`}><Pencil size={14} /> {t("admin.edit")}</Link>
          <form action={closeEvent}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="active" value={String(!item.active)} />
            <button className="button ghost small">{item.active ? t("admin.hide") : t("admin.show")}</button></form></div>
      </div>)}
    </section>
  </>;
}
