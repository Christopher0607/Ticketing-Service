import Link from "next/link";
import { ArrowRight, CircleDollarSign, Landmark, ListPlus, PlusCircle, Send, Ticket, Wallet } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { money, percent } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { fees, sellerSummary } from "@/lib/market";
import { sellerOrders } from "@/lib/orders";
import { requestSelling } from "@/app/actions";
import { Empty, Notice, Status } from "@/app/ui";

export async function generateMetadata() {
  const { t } = await i18n();
  return { title: t("nav.sell") };
}

export default async function SellHome({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
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
  const [summary, orders] = await Promise.all([sellerSummary(user.id), sellerOrders(user.id)]);
  const toTransfer = orders.filter((order) => order.status === "paid");
  return <>
    <div className="page-heading heading-split"><div><h1>{t("seller.hello", { name: user.name })}</h1><p>{t("seller.lead")}</p></div>
      <Link className="button primary" href="/sell/new"><PlusCircle size={17} /> {t("seller.nav.new")}</Link></div>
    <Notice t={t} error={params.error} success={params.success} />
    {!user.payout_account && <Link href="/sell/payouts" className="panel callout payout-alert"><Landmark size={20} /><div><strong>{t("seller.payout.title")}</strong><p>{t("seller.payout.missing")}</p></div><ArrowRight size={18} /></Link>}
    <div className="stat-grid">
      <div className="stat"><Ticket size={20} /><span>{t("seller.stat.live")}</span><strong>{summary.live}</strong></div>
      <div className="stat"><ListPlus size={20} /><span>{t("seller.stat.sold")}</span><strong>{summary.sold}</strong></div>
      <div className="stat gold"><Wallet size={20} /><span>{t("seller.stat.pending")}</span><strong>{money(summary.pending)}</strong></div>
      <div className="stat"><CircleDollarSign size={20} /><span>{t("seller.stat.paid")}</span><strong>{money(summary.paid)}</strong></div>
    </div>
    <section className="panel admin-panel"><h2><Send size={20} /> {t("seller.todo")} {toTransfer.length > 0 && <span className="tab-count">{toTransfer.length}</span>}</h2>
      {!toTransfer.length && <p className="muted">{t("seller.noTodo")}</p>}
      {toTransfer.map((order) => <Link className="admin-row admin-order" href={`/sell/orders/${order.id}`} key={order.id}>
        <div><strong>{order.title}</strong><p>{order.quantity} × {order.section} · {t("order.sendTo")} {order.buyer_email}</p></div>
        <span className="status status-paid">{t("seller.transferNow")}</span><ArrowRight size={16} /></Link>)}
    </section>
    <section className="panel admin-panel"><h2><CircleDollarSign size={20} /> {t("seller.recent")}</h2>
      {orders.length ? orders.slice(0, 6).map((order) => <Link className="admin-row admin-order" href={`/sell/orders/${order.id}`} key={order.id}>
        <div><strong>{order.title}</strong><p>{f.date(order.created_at)} · {t("seller.proceeds", { qty: order.quantity, amount: money(order.subtotal - order.seller_fee) })}</p></div>
        <Status t={t} value={order.settled_at && order.status === "confirmed" ? "settled" : order.status} /><ArrowRight size={16} /></Link>) :
        <Empty title={t("seller.noSales")}><Link className="button outline small" href="/sell/new">{t("seller.nav.new")}</Link></Empty>}
      {orders.length > 6 && <Link className="text-link" href="/sell/orders">{t("home.viewAll")}</Link>}
    </section>
  </>;
}
