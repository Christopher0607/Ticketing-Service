import Link from "next/link";
import { Pencil, PlusCircle, Ticket } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { query } from "@/lib/db";
import { fee, money } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { fees } from "@/lib/market";
import { closeListing, pauseListing, updateListing } from "@/app/actions";
import { Empty, Notice, Status } from "@/app/ui";

export const metadata = { title: "My listings" };

export default async function SellerListings({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [user, params, { t, f }, settings] = await Promise.all([requireSeller("/sell/listings"), searchParams, i18n(), fees()]);
  const listings = await query<{ id: string; title: string; slug: string; starts_at: Date; section: string; price: number; face_value: number | null; available: number;
    quantity: number; status: string; paused_by_admin: boolean }>(`
    SELECT l.id,l.section,l.price,l.face_value,l.available,l.quantity,l.status,l.paused_by_admin,e.title,e.slug,e.starts_at
    FROM listings l JOIN events e ON e.id=l.event_id WHERE seller_id=$1 AND l.status<>'closed' ORDER BY l.created_at DESC LIMIT 200`, [user.id]);
  return <>
    <div className="page-heading heading-split"><div><h1>{t("seller.listings")}</h1><p>{t("seller.listingsLead")}</p></div>
      <Link className="button primary" href="/sell/new"><PlusCircle size={17} /> {t("seller.nav.new")}</Link></div>
    <Notice t={t} error={params.error} success={params.success} />
    {listings.length ? <div className="row-list">{listings.map((listing) => <article className="panel dashboard-row" key={listing.id}>
      <span className="row-icon"><Ticket size={20} /></span>
      <div><strong><Link className="text-link" href={`/events/${listing.slug}`}>{listing.title}</Link></strong>
        <p>{f.date(listing.starts_at)} · {t("seller.availableOf", { section: listing.section, available: listing.available, quantity: listing.quantity })}</p>
        <p>{money(listing.price)}{listing.face_value !== null && ` · ${t("event.faceValue", { price: money(listing.face_value) })}`} · {t("seller.estimate", { amount: money(listing.price - fee(listing.price, settings.seller_bps)) })}</p></div>
      <Status t={t} value={listing.status} />
      {["active","paused"].includes(listing.status) && !listing.paused_by_admin && <form action={pauseListing}>
        <input type="hidden" name="id" value={listing.id} /><input type="hidden" name="decision" value={listing.status === "active" ? "paused" : "active"} />
        <button className="button outline small">{listing.status === "active" ? t("seller.pause") : t("seller.resume")}</button>
      </form>}
      {["pending","active","paused"].includes(listing.status) && <details className="listing-edit">
        <summary><Pencil size={14} /> {t("seller.edit")}</summary>
        <form action={updateListing} className="form-stack">
          <input type="hidden" name="id" value={listing.id} />
          <div className="form-columns"><label>{t("seller.list.price")}<input name="price" type="number" min={2} max={25000} step=".01" required defaultValue={(listing.price / 100).toFixed(2)} /></label>
            <label>{t("seller.editAvailable")}<input name="available" type="number" min={0} max={listing.available} required defaultValue={listing.available} /></label></div>
          <small>{t("seller.editHint")}</small>
          <button className="button primary small">{t("seller.saveListing")}</button>
        </form>
        <form action={closeListing}><input type="hidden" name="id" value={listing.id} /><button className="button ghost small">{t("seller.close")}</button></form>
      </details>}
    </article>)}</div> : <Empty title={t("seller.noListings")}><Link className="button primary" href="/sell/new">{t("seller.nav.new")}</Link></Empty>}
  </>;
}
