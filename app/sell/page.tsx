import Link from "next/link";
import { ChevronRight, CircleDollarSign, Landmark, ListPlus, Ticket } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { paymentMode } from "@/lib/config";
import { query } from "@/lib/db";
import { fee, money, percent } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { events, fees } from "@/lib/market";
import { recentOrders } from "@/lib/orders";
import { createListing, onboarding, pauseListing, refreshPayouts, requestSelling, savePayout } from "../actions";
import { Empty, Notice, Status, SupportLinks } from "../ui";

export async function generateMetadata() {
  const { t } = await i18n();
  return { title: t("nav.sell") };
}

export default async function Seller({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; connect?: string }> }) {
  const [user, params, { t, f }, settings] = await Promise.all([currentUser(), searchParams, i18n(), fees()]);
  if (user?.role !== "seller") {
    const [application] = user?.role === "buyer" ? await query<{ seller_requested: boolean }>("SELECT seller_requested FROM users WHERE id=$1", [user.id]) : [];
    return <div className="shell page sell-landing">
      <div className="page-heading centered"><img src="/logo.png" alt="" className="landing-logo" width={96} height={96} /><h1>{t("sell.title")}</h1><p>{t("sell.lead")}</p></div>
      <div className="feature-grid">
        <div className="panel feature"><span className="feature-icon"><ListPlus size={24} /></span><h2>{t("sell.f1.title")}</h2><p>{t("sell.f1.body")}</p></div>
        <div className="panel feature"><span className="feature-icon"><Ticket size={24} /></span><h2>{t("sell.f2.title")}</h2><p>{t("sell.f2.body")}</p></div>
        <div className="panel feature"><span className="feature-icon"><CircleDollarSign size={24} /></span><h2>{t("sell.f3.title")}</h2><p>{t("sell.f3.body", { fee: percent(settings.seller_bps) })}</p></div>
      </div>
      <Notice t={t} error={params.error} success={params.success} />
      {user?.role === "admin" ? <Link className="button primary" href="/admin">{t("sell.admin")}</Link> : application?.seller_requested ?
        <Link className="button primary" href="/account">{t("sell.viewApplication")}</Link> : user ?
        <form action={requestSelling} className="panel apply-form form-stack">
          <label>{t("sell.phone")}<input name="phone" type="tel" inputMode="tel" required placeholder="012-345 6789" autoComplete="tel" maxLength={20} /></label>
          <small>{t("sell.phoneHint")}</small>
          <button className="button primary">{t("sell.apply")}</button>
        </form> :
        <Link className="button primary" href="/account?next=%2Fsell">{t("sell.signIn")}</Link>}
    </div>;
  }
  const mode = paymentMode();
  const [listings, catalogue, orders] = await Promise.all([
    query<{ id: string; title: string; section: string; price: number; available: number; quantity: number; status: string; paused_by_admin: boolean }>(`
      SELECT l.id,l.section,l.price,l.available,l.quantity,l.status,l.paused_by_admin,e.title FROM listings l JOIN events e ON e.id=l.event_id
      WHERE seller_id=$1 ORDER BY l.created_at DESC LIMIT 100`, [user.id]),
    events(), recentOrders(user.id, "seller"),
  ]);
  const cap = settings.max_markup_bps;
  return <div className="shell page">
    <div className="page-heading"><h1>{t("seller.title")}</h1><p>{t("seller.lead")}</p></div>
    <Notice t={t} error={params.error} success={params.success} />
    {mode === "stripe" && <section className="panel callout"><div><h2>{t("seller.stripe.title")}</h2>
      <p>{user.stripe_ready ? t("seller.stripe.ready") : params.connect ? t("seller.stripe.check") : t("seller.stripe.todo")}</p></div>
      <div className="inline-form"><form action={onboarding}><button className="button outline">{t("seller.stripe.open")}</button></form>
      {user.stripe_account && <form action={refreshPayouts}><button className="button outline">{t("seller.stripe.status")}</button></form>}</div></section>}
    {mode !== "stripe" && <details className="panel callout payout" open={!user.payout_account}>
      <summary><Landmark size={20} /> <span><strong>{t("seller.payout.title")}</strong>
        <small>{user.payout_account ? `${user.payout_bank} · ${user.payout_name} · ${user.payout_account}` : t("seller.payout.missing")}</small></span></summary>
      <form action={savePayout} className="form-stack">
        <p>{t("seller.payout.lead")}</p>
        <div className="form-columns three">
          <label>{t("seller.payout.bank")}<input name="bank" required minLength={2} maxLength={60} defaultValue={user.payout_bank ?? ""} placeholder="Maybank / TNG" /></label>
          <label>{t("seller.payout.name")}<input name="holder" required minLength={2} maxLength={80} defaultValue={user.payout_name ?? ""} /></label>
          <label>{t("seller.payout.account")}<input name="account" required minLength={4} maxLength={40} defaultValue={user.payout_account ?? ""} /></label>
        </div>
        <button className="button primary">{t("seller.payout.save")}</button>
      </form>
    </details>}
    <div className="detail-grid dashboard-grid">
      <section>
        <div className="section-header compact"><div><h2>{t("seller.listings")}</h2></div></div>
        {listings.length ? <div className="row-list">{listings.map((listing) => <article className="panel dashboard-row" key={listing.id}>
          <span className="row-icon"><Ticket size={20} /></span>
          <div><strong>{listing.title}</strong><p>{t("seller.availableOf", { section: listing.section, available: listing.available, quantity: listing.quantity })}</p>
            <p>{t("seller.estimate", { amount: money(listing.price - fee(listing.price, settings.seller_bps)) })}</p></div>
          <Status t={t} value={listing.status} />
          {["active","paused"].includes(listing.status) && !listing.paused_by_admin && <form action={pauseListing}>
            <input type="hidden" name="id" value={listing.id} /><input type="hidden" name="decision" value={listing.status === "active" ? "paused" : "active"} />
            <button className="button outline small">{listing.status === "active" ? t("seller.pause") : t("seller.resume")}</button>
          </form>}
        </article>)}</div> : <Empty title={t("seller.noListings")} />}
        <div className="section-header compact"><div><h2>{t("seller.sales")}</h2></div></div>
        {orders.length ? <div className="row-list">{orders.map((order) => <Link className="panel dashboard-row" href={`/orders/${order.id}`} key={order.id}>
          <span className="row-icon"><CircleDollarSign size={20} /></span>
          <div><strong>{order.title}</strong><p>{f.date(order.starts_at)} · {t("seller.proceeds", { qty: order.quantity, amount: money(order.subtotal - order.seller_fee) })}</p></div>
          <Status t={t} value={order.settled_at && order.status === "confirmed" ? "settled" : order.status} /><ChevronRight size={18} /></Link>)}</div> : <Empty title={t("seller.noSales")} />}
      </section>
      <aside className="panel list-form">
        <h2>{t("seller.list.title")}</h2>
        <p>{t("seller.list.fee", { fee: percent(settings.seller_bps) })}{cap !== null && <> {cap === 0 ? t("seller.list.capFace") : t("seller.list.cap", { pct: percent(cap) })}</>}</p>
        {catalogue.length ? <form className="form-stack" action={createListing}>
          <label>{t("seller.list.event")}<select name="event" aria-label={t("seller.list.event")} required defaultValue=""><option value="" disabled>{t("seller.list.choose")}</option>{catalogue.map((item) => <option key={item.id} value={item.id}>{item.title} · {f.date(item.starts_at)}</option>)}</select></label>
          <label>{t("seller.list.section")}<input name="section" required minLength={2} maxLength={80} placeholder={t("seller.list.sectionPh")} /></label>
          <div className="form-columns"><label>{t("seller.list.face")}<input name="face" type="number" min={1} max={25000} step=".01" required inputMode="decimal" /></label>
            <label>{t("seller.list.price")}<input name="price" type="number" min={2} max={25000} step=".01" required inputMode="decimal" /></label></div>
          <label>{t("seller.list.quantity")}<input name="quantity" type="number" min={1} max={100} required defaultValue={1} /></label>
          <label>{t("seller.list.proof")}<textarea name="proof" required minLength={5} maxLength={1000} placeholder={t("seller.list.proofPh")} /></label>
          <label>{t("seller.list.file")}<input name="attachment" type="file" accept="application/pdf,image/png,image/jpeg" /></label>
          <small>{t("seller.list.fileHint")}</small>
          <button className="button primary">{t("seller.list.submit")}</button>
        </form> : <p>{t("seller.list.noEvents")}</p>}
        <hr /><small>{t("seller.list.missing")}</small><SupportLinks t={t} />
      </aside>
    </div>
  </div>;
}
