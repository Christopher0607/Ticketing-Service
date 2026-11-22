import Link from "next/link";
import {
  BadgeDollarSign, CalendarPlus, ChevronRight, ClipboardList, Landmark, ListChecks, MessageCircle, Percent, QrCode,
  ReceiptText, Ticket, Undo2, Users, Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { paymentMode } from "@/lib/config";
import { query } from "@/lib/db";
import { money, shortId } from "@/lib/format";
import { i18n, type Translate } from "@/lib/i18n";
import { fees, paymentSettings } from "@/lib/market";
import { recentOrders, type Order } from "@/lib/orders";
import { approveSeller, closeEvent, createEvent, reviewListing, savePaymentSettings, updateFees } from "../actions";
import { Notice, Status } from "../ui";
import { EventForm } from "./event-form";

export const metadata = { title: "Admin" };
const tabs = ["review", "orders", "events", "settings"] as const;
type Tab = (typeof tabs)[number];

function OrderRows({ t, orders, empty }: { t: Translate; orders: Order[]; empty: string }) {
  if (!orders.length) return <p className="muted">{empty}</p>;
  return <>{orders.map((order) => <Link className="admin-row admin-order" href={`/orders/${order.id}`} key={order.id}>
    <div><strong>{order.title}</strong><p>{shortId(order.id)} · {order.buyer_name} · {money(order.subtotal + order.buyer_fee)}</p></div>
    <Status t={t} value={order.settled_at && order.status === "confirmed" ? "settled" : order.status} /><ChevronRight size={17} /></Link>)}</>;
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; tab?: string }> }) {
  const user = await requireUser("/admin", "admin");
  const [params, { t, f }] = await Promise.all([searchParams, i18n()]);
  const tab: Tab = tabs.find((value) => value === params.tab) ?? "review";
  const [[stats], applications, listings, verifying, refunds, confirmed] = await Promise.all([
    query<{ gmv: number; commission: number; listings: number; pending_listings: number }>(`SELECT
      (SELECT coalesce(sum(subtotal+buyer_fee),0)::int FROM orders WHERE status IN ('paid','delivered','confirmed')) AS gmv,
      (SELECT coalesce(sum(buyer_fee+seller_fee),0)::int FROM orders WHERE status IN ('paid','delivered','confirmed')) AS commission,
      (SELECT count(*)::int FROM listings WHERE status='active' AND available>0) AS listings,
      (SELECT count(*)::int FROM listings WHERE status='pending') AS pending_listings`),
    query<{ id: string; name: string; email: string; phone: string | null }>("SELECT id,name,email,phone FROM users WHERE seller_requested AND role='buyer' ORDER BY created_at LIMIT 100"),
    query<{ id: string; title: string; name: string; section: string; price: number; face_value: number | null; quantity: number; status: string; proof: string; proof_type: string | null }>(`
      SELECT l.id,l.section,l.price,l.face_value,l.quantity,l.status,l.proof,l.proof_type,e.title,u.name FROM listings l JOIN events e ON e.id=l.event_id JOIN users u ON u.id=l.seller_id
      WHERE l.status IN ('pending','active','paused') ORDER BY (l.status='pending') DESC,l.created_at DESC LIMIT 100`),
    recentOrders(user.id, "admin", ["verifying"]),
    recentOrders(user.id, "admin", ["refund_requested"]),
    recentOrders(user.id, "admin", ["confirmed"]),
  ]);
  const toSettle = confirmed.filter((order) => !order.settled_at && order.starts_at.getTime() + 86400000 <= Date.now());
  const pending = verifying.length + refunds.length + toSettle.length + applications.length + stats.pending_listings;
  const counts: Record<Tab, number> = { review: pending, orders: 0, events: 0, settings: 0 };
  return <div className="shell page">
    <div className="page-heading"><h1>{t("admin.title")}</h1><p>{t("admin.lead")}</p></div>
    <div className="stat-grid">
      <div className="stat"><BadgeDollarSign size={20} /><span>{t("admin.stat.gmv")}</span><strong>{money(stats.gmv)}</strong></div>
      <div className="stat gold"><Wallet size={20} /><span>{t("admin.stat.commission")}</span><strong>{money(stats.commission)}</strong></div>
      <div className="stat"><ListChecks size={20} /><span>{t("admin.stat.pending")}</span><strong>{pending}</strong></div>
      <div className="stat"><Ticket size={20} /><span>{t("admin.stat.listings")}</span><strong>{stats.listings}</strong></div>
    </div>
    <nav className="tabs" aria-label={t("admin.tabs")}>{tabs.map((value) => <Link key={value} href={`/admin?tab=${value}`} className={value === tab ? "tab active" : "tab"} aria-current={value === tab ? "page" : undefined}>
      {t(`admin.tab.${value}`)}{counts[value] > 0 && <span className="tab-count">{counts[value]}</span>}</Link>)}</nav>
    <Notice t={t} error={params.error} success={params.success} />

    {tab === "review" && <div className="admin-grid">
      <div className="row-list">
        <section className="panel admin-panel"><h2><ReceiptText size={20} /> {t("admin.payments")}</h2>
          <OrderRows t={t} orders={verifying} empty={t("admin.noPayments")} /></section>
        {refunds.length > 0 && <section className="panel admin-panel"><h2><Undo2 size={20} /> {t("admin.refunds")}</h2>
          <OrderRows t={t} orders={refunds} empty="" /></section>}
        <section className="panel admin-panel"><h2><Landmark size={20} /> {t("admin.toSettle")}</h2>
          <OrderRows t={t} orders={toSettle} empty={t("admin.noSettle")} /></section>
      </div>
      <div className="row-list">
        <section className="panel admin-panel"><h2><Users size={20} /> {t("admin.applications")}</h2>
          {!applications.length && <p className="muted">{t("admin.noApplications")}</p>}
          {applications.map((application) => <div className="admin-row" key={application.id}><div><strong>{application.name}</strong><p>{application.email}</p>
            {application.phone && <a className="text-link" href={`https://wa.me/${application.phone}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> +{application.phone}</a>}</div>
            <form action={approveSeller}><input type="hidden" name="id" value={application.id} /><button className="button outline small">{t("admin.approveSeller")}</button></form></div>)}
        </section>
        <section className="panel admin-panel"><h2><Ticket size={20} /> {t("admin.listings")}</h2>
          {!listings.length && <p className="muted">{t("admin.noListings")}</p>}
          {listings.map((listing) => <div className="admin-listing" key={listing.id}><div className="admin-row"><div><strong>{listing.title} · {listing.section}</strong>
            <p>{t("admin.listingMeta", { seller: listing.name, qty: listing.quantity, price: money(listing.price) })}{listing.face_value !== null && ` · ${t("admin.face", { price: money(listing.face_value) })}`}</p></div><Status t={t} value={listing.status} /></div>
            <details><summary>{t("admin.viewProof")}</summary><p className="wrap">{listing.proof}</p>{listing.proof_type && <a className="text-link" href={`/api/admin/listings/${listing.id}/proof`}>{t("admin.downloadProof")}</a>}</details>
            <form className="inline-form" action={reviewListing}><input type="hidden" name="id" value={listing.id} />
              {listing.status !== "active" && <button className="button outline small" name="decision" value="active">{listing.status === "pending" ? t("admin.approveListing") : t("admin.resumeListing")}</button>}
              {listing.status === "pending" && <button className="button outline small" name="decision" value="rejected">{t("admin.declineListing")}</button>}
              {listing.status === "active" && <button className="button outline small" name="decision" value="paused">{t("admin.pauseListing")}</button>}
            </form></div>)}
        </section>
      </div>
    </div>}

    {tab === "orders" && <AdminOrders t={t} userId={user.id} />}
    {tab === "events" && <AdminEvents t={t} date={f.date} />}
    {tab === "settings" && <AdminSettings t={t} />}
  </div>;
}

async function AdminOrders({ t, userId }: { t: Translate; userId: string }) {
  const orders = await recentOrders(userId, "admin");
  return <section className="panel admin-panel"><h2><ClipboardList size={20} /> {t("admin.orders")}</h2>
    <OrderRows t={t} orders={orders} empty={t("admin.noOrders")} /></section>;
}

async function AdminEvents({ t, date }: { t: Translate; date: (value: Date) => string }) {
  const catalogue = await query<{ id: string; slug: string; title: string; starts_at: Date; active: boolean }>("SELECT id,slug,title,starts_at,active FROM events ORDER BY starts_at DESC LIMIT 100");
  return <div className="admin-grid">
    <section className="panel admin-panel"><h2><CalendarPlus size={20} /> {t("admin.publish")}</h2><p className="muted">{t("admin.publishLead")}</p>
      <EventForm t={t} action={createEvent} /></section>
    <section className="panel admin-panel"><h2>{t("admin.catalogue")}</h2>
      {!catalogue.length && <p className="muted">{t("admin.noEvents")}</p>}
      {catalogue.map((item) => <div className="admin-row" key={item.id}><div>
        {item.active ? <Link className="text-link" href={`/events/${item.slug}`}>{item.title}</Link> : <strong>{item.title} <span className="status status-paused">{t("admin.hidden")}</span></strong>}
        <p>{date(item.starts_at)}</p></div>
        <div className="inline-form"><Link className="button outline small" href={`/admin/events/${item.id}`}>{t("admin.edit")}</Link>
          <form action={closeEvent}>
            <input type="hidden" name="id" value={item.id} /><input type="hidden" name="active" value={String(!item.active)} />
            <button className="button ghost small">{item.active ? t("admin.hide") : t("admin.show")}</button></form></div></div>)}
    </section>
  </div>;
}

async function AdminSettings({ t }: { t: Translate }) {
  const [settings, pay] = await Promise.all([fees(), paymentSettings()]);
  const mode = paymentMode();
  return <div className="admin-grid">
    <section className="panel admin-panel"><h2><Percent size={20} /> {t("admin.fees")}</h2><p className="muted">{t("admin.feesLead")}</p>
      <form action={updateFees} className="form-stack"><div className="form-columns"><label>{t("admin.buyerFee")}<input name="buyer fee" type="number" min={0} max={30} step=".01" required defaultValue={settings.buyer_bps / 100} /></label>
        <label>{t("admin.sellerFee")}<input name="seller fee" type="number" min={0} max={30} step=".01" required defaultValue={settings.seller_bps / 100} /></label></div>
        <label>{t("admin.maxMarkup")}<input name="max markup" type="number" min={0} max={1000} step=".01" defaultValue={settings.max_markup_bps === null ? "" : settings.max_markup_bps / 100} /></label>
        <small>{t("admin.maxMarkupHint")}</small>
        <button className="button primary">{t("admin.saveRates")}</button></form>
    </section>
    <section className="panel admin-panel"><h2><QrCode size={20} /> {t("admin.payment")}</h2>
      <p className="muted">{t("admin.paymentLead")} {t("admin.mode", { mode: mode ? t(`mode.${mode}`) : t("admin.modeNone") })}</p>
      <form action={savePaymentSettings} className="form-stack">
        <div className="form-columns"><label>{t("pay.bank")}<input name="bank" maxLength={60} defaultValue={pay.bank_name ?? ""} placeholder="Maybank" /></label>
          <label>{t("pay.accountName")}<input name="holder" maxLength={80} defaultValue={pay.account_name ?? ""} /></label></div>
        <div className="form-columns"><label>{t("pay.accountNumber")}<input name="account" maxLength={40} defaultValue={pay.account_number ?? ""} /></label>
          <label>{t("pay.duitnow")}<input name="duitnow" maxLength={60} defaultValue={pay.duitnow_id ?? ""} /></label></div>
        <div className="poster-field">{pay.qr_id && <img src={`/media/${pay.qr_id}`} alt="" className="qr-preview" />}
          <label>{t("admin.qr")}<input name="qr" type="file" accept="image/jpeg,image/png,image/webp" /></label></div>
        <label>{t("admin.note")}<textarea name="note" maxLength={300} defaultValue={pay.note ?? ""} /></label>
        <button className="button primary">{t("admin.savePayment")}</button>
      </form>
    </section>
  </div>;
}
