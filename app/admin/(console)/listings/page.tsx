import Link from "next/link";
import { Ticket } from "lucide-react";
import { query } from "@/lib/db";
import { money } from "@/lib/format";
import { i18n, type MessageKey } from "@/lib/i18n";
import { reviewListing } from "@/app/actions";
import { Notice, Status } from "@/app/ui";

export const metadata = { title: "Listings" };

const filters = { pending: ["pending"], active: ["active"], paused: ["paused"], all: ["pending", "active", "paused", "rejected", "closed"] } as const;
type Filter = keyof typeof filters;

export default async function AdminListings({ searchParams }: { searchParams: Promise<{ show?: string; error?: string; success?: string }> }) {
  const [params, { t, f }] = await Promise.all([searchParams, i18n()]);
  const show: Filter = (Object.keys(filters) as Filter[]).find((value) => value === params.show) ?? "pending";
  const listings = await query<{ id: string; title: string; starts_at: Date; slug: string; name: string; seller_id: string; section: string; price: number;
    face_value: number | null; quantity: number; available: number; status: string; proof: string; proof_type: string | null }>(`
    SELECT l.id,l.section,l.price,l.face_value,l.quantity,l.available,l.status,l.proof,l.proof_type,e.title,e.starts_at,e.slug,u.name,u.id AS seller_id
    FROM listings l JOIN events e ON e.id=l.event_id JOIN users u ON u.id=l.seller_id
    WHERE l.status=ANY($1) ORDER BY l.created_at DESC LIMIT 200`, [[...filters[show]]]);
  return <>
    <div className="page-heading"><h1>{t("admin.listings")}</h1><p>{t("console.listingsLead")}</p></div>
    <Notice t={t} error={params.error} success={params.success} />
    <div className="chip-row">{(Object.keys(filters) as Filter[]).map((value) => <Link key={value} href={`/admin/listings?show=${value}`} className={value === show ? "chip active" : "chip"}>
      {t(`console.listings.${value}` as MessageKey)}</Link>)}</div>
    <section className="panel admin-panel"><h2><Ticket size={20} /> {t("console.results", { count: listings.length })}</h2>
      {!listings.length && <p className="muted">{t("admin.noListings")}</p>}
      {listings.map((listing) => <div className="admin-listing" key={listing.id}><div className="admin-row"><div>
        <strong><Link className="text-link" href={`/events/${listing.slug}`}>{listing.title}</Link> · {listing.section}</strong>
        <p>{f.date(listing.starts_at)} · {t("admin.listingMeta", { seller: listing.name, qty: listing.quantity, price: money(listing.price) })}
          {listing.face_value !== null && ` · ${t("admin.face", { price: money(listing.face_value) })}`} · {t("event.left", { count: listing.available })}</p></div>
        <Status t={t} value={listing.status} /></div>
        <details><summary>{t("admin.viewProof")}</summary><p className="wrap">{listing.proof}</p>{listing.proof_type && <a className="text-link" href={`/api/admin/listings/${listing.id}/proof`}>{t("admin.downloadProof")}</a>}</details>
        <form className="inline-form" action={reviewListing}><input type="hidden" name="id" value={listing.id} />
          {["pending", "paused"].includes(listing.status) && <button className="button primary small" name="decision" value="active">{listing.status === "pending" ? t("admin.approveListing") : t("admin.resumeListing")}</button>}
          {listing.status === "pending" && <button className="button outline small" name="decision" value="rejected">{t("admin.declineListing")}</button>}
          {listing.status === "active" && <button className="button outline small" name="decision" value="paused">{t("admin.pauseListing")}</button>}
        </form></div>)}
    </section>
  </>;
}
