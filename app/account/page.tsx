import Link from "next/link";
import { ChevronRight, Heart, KeyRound, ReceiptText, Ticket, UserRound } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/identity";
import { query } from "@/lib/db";
import { money, posterUrl } from "@/lib/format";
import { i18n, type MessageKey } from "@/lib/i18n";
import { favoriteEvents, fees } from "@/lib/market";
import { recentOrders } from "@/lib/orders";
import { changePassword, resendVerification, signIn, signOut, signUp, toggleFavorite, updateProfile } from "../actions";
import { Empty, EventCard, Notice, Status } from "../ui";

export async function generateMetadata() {
  const { t } = await i18n();
  return { title: t("account.title") };
}

const tabs = ["orders", "favorites", "profile"] as const;
const groups = {
  all: [] as string[],
  pending: ["reserved", "verifying"],
  active: ["paid", "delivered"],
  done: ["confirmed"],
  refunds: ["refund_requested", "refund_pending", "refunded", "disputed"],
};
type Group = keyof typeof groups;

type Search = { mode?: string; next?: string; error?: string; success?: string; notice?: string; tab?: string; show?: string };

export default async function Account({ searchParams }: { searchParams: Promise<Search> }) {
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
        {register && <label className="check-label consent"><input type="checkbox" name="agree" required />
          <span>{t("account.agree1")} <Link className="text-link" href="/legal/terms" target="_blank">{t("footer.terms")}</Link> {t("account.agree2")} <Link className="text-link" href="/legal/privacy" target="_blank">{t("footer.privacy")}</Link>{t("account.agree3")}</span></label>}
        <button className="button primary">{register ? t("account.createBtn") : t("account.signInBtn")}</button>
      </form>
      {!register && mailConfigured() && <p><Link className="text-link" href="/account/recover">{t("account.forgot")}</Link></p>}
      <p className="auth-switch">{register ? t("account.have") : t("account.new")} <Link className="text-link" href={`/account?${new URLSearchParams({ mode: register ? "login" : "register", next })}`}>{register ? t("account.signInBtn") : t("account.createLink")}</Link></p>
    </section></div>;
  }
  const tab = tabs.find((value) => value === params.tab) ?? "orders";
  const group: Group = (Object.keys(groups) as Group[]).find((value) => value === params.show) ?? "all";
  const [orders, favorites, settings, [profile]] = await Promise.all([
    tab === "orders" ? recentOrders(user.id, "buyer") : Promise.resolve([]),
    tab === "favorites" ? favoriteEvents(user.id) : Promise.resolve([]),
    fees(),
    query<{ seller_requested: boolean; phone: string | null }>("SELECT seller_requested,phone FROM users WHERE id=$1", [user.id]),
  ]);
  const shown = group === "all" ? orders : orders.filter((order) => groups[group].includes(order.status));
  const tabIcons = { orders: ReceiptText, favorites: Heart, profile: UserRound };
  return <div className="shell page">
    <div className="page-heading heading-split"><div className="account-head"><span className="avatar"><UserRound size={22} /></span><div><h1>{t("account.title")}</h1><p>{user.name} · {user.email}</p></div></div>
      <form action={signOut}><button className="button outline">{t("account.signOut")}</button></form></div>
    <Notice t={t} error={params.error} success={params.success} />
    {!user.email_verified && <section className="panel callout"><div><h2>{t("account.verify.title")}</h2><p>{t("account.verify.body")}</p></div>
      <form action={resendVerification}><button className="button outline">{t("account.verify.send")}</button></form></section>}
    <nav className="tabs" aria-label={t("account.title")}>{tabs.map((value) => {
      const Icon = tabIcons[value];
      return <Link key={value} href={`/account?tab=${value}`} className={value === tab ? "tab active" : "tab"} aria-current={value === tab ? "page" : undefined}><Icon size={16} /> {t(`account.tab.${value}`)}</Link>;
    })}</nav>
    <div className="detail-grid">
      <section>
        {tab === "orders" && <>
          <div className="chip-row">{(Object.keys(groups) as Group[]).map((value) => <Link key={value} href={`/account?tab=orders${value === "all" ? "" : `&show=${value}`}`}
            className={value === group ? "chip active" : "chip"}>{t(`account.show.${value}` as MessageKey)}</Link>)}</div>
          {shown.length ? <div className="row-list">{shown.map((order) => <Link className="panel dashboard-row order-row" key={order.id} href={`/orders/${order.id}`}>
            <span className="row-thumb"><img src={posterUrl(order)} alt="" /></span>
            <div><strong>{order.title}</strong><p>{f.date(order.starts_at)} · {t("account.tickets", { count: order.quantity })} · {order.section}</p></div>
            <Status t={t} value={order.status} /><strong className="row-total">{money(order.subtotal + order.buyer_fee)}</strong><ChevronRight size={18} />
          </Link>)}</div> : <Empty title={t("account.noOrders")}><Link className="button primary" href="/events">{t("account.explore")}</Link></Empty>}
        </>}
        {tab === "favorites" && (favorites.length ? <><p className="muted favorites-hint">{t("account.favoritesHint")}</p>
          <div className="event-grid compact">{favorites.map((item) => <div key={item.id} className="favorite-item">
            <EventCard item={item} bps={settings.buyer_bps} t={t} f={f} />
            <form action={toggleFavorite}><input type="hidden" name="event" value={item.id} /><input type="hidden" name="from" value="account" />
              <button className="button ghost small"><Heart size={14} /> {t("account.unsave")}</button></form>
          </div>)}</div></> :
          <Empty title={t("account.noFavorites")}><Link className="button primary" href="/events">{t("account.explore")}</Link></Empty>)}
        {tab === "profile" && <div className="row-list">
          <form action={updateProfile} className="panel form-stack"><h2><UserRound size={19} /> {t("account.profile")}</h2>
            <label>{t("account.name")}<input name="name" required minLength={2} maxLength={80} defaultValue={user.name} /></label>
            <label>{t("sell.phone")}<input name="phone" type="tel" maxLength={20} defaultValue={profile?.phone ? `+${profile.phone}` : ""} placeholder="012-345 6789" /></label>
            <p className="muted">{t("account.email")}: {user.email}</p>
            <button className="button primary">{t("account.saveProfile")}</button></form>
          <form action={changePassword} className="panel form-stack"><h2><KeyRound size={19} /> {t("account.changePassword")}</h2>
            <label>{t("account.currentPassword")}<input name="current" type="password" required autoComplete="current-password" maxLength={128} /></label>
            <label>{t("task.newPassword")}<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
            <small>{t("account.passwordHint")}</small>
            <button className="button outline">{t("account.changePassword")}</button></form>
        </div>}
      </section>
      <aside className="panel"><h2><Ticket size={19} /> {t("account.sell")}</h2>
        {user.role === "admin" ? <Link className="button outline" href="/admin">{t("account.openAdmin")}</Link> :
          user.role === "seller" ? <><Link className="button outline" href="/sell">{t("account.openSeller")}</Link>
            <p><Link className="text-link" href={`/sellers/${user.id}`}>{t("account.publicProfile")}</Link></p></> :
          profile?.seller_requested ? <p>{t("account.inReview")}</p> : <>
            <p>{params.notice === "seller-access" ? t("account.applyNotice") : t("account.applyLead")}</p>
            <Link className="button outline" href="/sell">{t("sell.apply")}</Link>
          </>}
      </aside>
    </div>
  </div>;
}
