import Link from "next/link";
import { ChevronRight, Ticket, UserRound } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/identity";
import { query } from "@/lib/db";
import { money, posterUrl } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { recentOrders } from "@/lib/orders";
import { resendVerification, signIn, signOut, signUp } from "../actions";
import { Empty, Notice, Status } from "../ui";

export async function generateMetadata() {
  const { t } = await i18n();
  return { title: t("account.title") };
}

export default async function Account({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string; error?: string; success?: string; notice?: string }> }) {
  const [user, params, { t, f }] = await Promise.all([currentUser(), searchParams, i18n()]);
  const next = typeof params.next === "string" ? params.next : "/account";
  if (!user) {
    const register = params.mode === "register";
    return <div className="shell page auth-page"><section className="panel auth-card">
      <img src="/logo.png" alt="" className="auth-logo" width={72} height={72} />
      <h1>{register ? t("account.create") : t("account.welcome")}</h1>
      <p>{register ? t("account.createLead") : t("account.signInLead")}</p>
      <Notice t={t} error={params.error} success={params.success} />
      <form className="form-stack" action={register ? signUp : signIn}>
        <input type="hidden" name="next" value={next} />
        {register && <label>{t("account.name")}<input required name="name" autoComplete="name" maxLength={80} /></label>}
        <label>{t("account.email")}<input required name="email" type="email" autoComplete="email" maxLength={254} /></label>
        <label>{t("account.password")}<input required name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 12 : undefined} maxLength={128} /></label>
        {register && <small>{t("account.passwordHint")}</small>}
        <button className="button primary">{register ? t("account.createBtn") : t("account.signInBtn")}</button>
      </form>
      {!register && mailConfigured() && <p><Link className="text-link" href="/account/recover">{t("account.forgot")}</Link></p>}
      <p className="auth-switch">{register ? t("account.have") : t("account.new")} <Link className="text-link" href={`/account?${new URLSearchParams({ mode: register ? "login" : "register", next })}`}>{register ? t("account.signInBtn") : t("account.createLink")}</Link></p>
    </section></div>;
  }
  const [orders, [application]] = await Promise.all([
    recentOrders(user.id, "buyer"),
    query<{ seller_requested: boolean }>("SELECT seller_requested FROM users WHERE id=$1", [user.id]),
  ]);
  return <div className="shell page">
    <div className="page-heading heading-split"><div className="account-head"><span className="avatar"><UserRound size={22} /></span><div><h1>{t("account.title")}</h1><p>{user.name} · {user.email}</p></div></div>
      <form action={signOut}><button className="button outline">{t("account.signOut")}</button></form></div>
    <Notice t={t} error={params.error} success={params.success} />
    {!user.email_verified && <section className="panel callout"><div><h2>{t("account.verify.title")}</h2><p>{t("account.verify.body")}</p></div>
      <form action={resendVerification}><button className="button outline">{t("account.verify.send")}</button></form></section>}
    <div className="detail-grid">
      <section><div className="section-header compact"><div><h2>{t("account.orders")}</h2></div></div>
        {orders.length ? <div className="row-list">{orders.map((order) => <Link className="panel dashboard-row order-row" key={order.id} href={`/orders/${order.id}`}>
          <span className="row-thumb"><img src={posterUrl(order)} alt="" /></span>
          <div><strong>{order.title}</strong><p>{f.date(order.starts_at)} · {t("account.tickets", { count: order.quantity })}</p></div>
          <Status t={t} value={order.status} /><strong className="row-total">{money(order.subtotal + order.buyer_fee)}</strong><ChevronRight size={18} />
        </Link>)}</div> : <Empty title={t("account.noOrders")}><Link className="button primary" href="/events">{t("account.explore")}</Link></Empty>}
      </section>
      <aside className="panel"><h2><Ticket size={19} /> {t("account.sell")}</h2>
        {user.role === "admin" ? <Link className="button outline" href="/admin">{t("account.openAdmin")}</Link> :
          user.role === "seller" ? <Link className="button outline" href="/sell">{t("account.openSeller")}</Link> :
          application?.seller_requested ? <p>{t("account.inReview")}</p> : <>
            <p>{params.notice === "seller-access" ? t("account.applyNotice") : t("account.applyLead")}</p>
            <Link className="button outline" href="/sell">{t("sell.apply")}</Link>
          </>}
      </aside>
    </div>
  </div>;
}
