import Link from "next/link";
import {
  BadgeCheck, CalendarDays, ChevronDown, Clapperboard, Mail, MapPin, MessageCircle, Music2, Search, ShieldCheck,
  Sparkles, Ticket, Trophy, UserRound,
} from "lucide-react";
import { currentUser } from "@/lib/auth";
import { site } from "@/lib/config";
import { categories, money, posterUrl, shortId, type Category, type Formatters } from "@/lib/format";
import { i18n, type MessageKey, type Translate } from "@/lib/i18n";
import { priceWithFee, type Event } from "@/lib/market";
import { LangSwitch, TabBar } from "./client";

export const categoryIcons = { Concerts: Music2, Festivals: Sparkles, Sports: Trophy, "Arts & Theatre": Clapperboard };
export const categoryLabel = (t: Translate, category: Category | "") => t(category ? `cat.${category}` : "cat.all");

export function Logo({ t }: { t: Translate }) {
  return <Link className="brand" href="/" aria-label={`${t("brand.name")} ${t("brand.tagline")}`}>
    <img className="brand-mark" src="/logo-96.png" alt="" width={44} height={44} />
    <span className="brand-words"><span className="brand-name">CRAZY MONKEY</span><span className="brand-sub">{t("brand.tagline")}</span></span>
  </Link>;
}

export async function Header() {
  const [user, { t, locale }] = await Promise.all([currentUser(), i18n()]);
  const groupBuy = site.groupBuyUrl();
  return <>
    <header className="topbar"><div className="shell header-inner">
      <Logo t={t} />
      <nav className="main-nav" aria-label={t("nav.main")}>
        <Link href="/events">{t("nav.explore")}</Link>
        <Link href="/how-it-works">{t("nav.how")}</Link>
        {groupBuy && <a href={groupBuy}>{t("nav.groupBuy")}</a>}
      </nav>
      <div className="nav-actions">
        <LangSwitch to={locale === "zh" ? "en" : "zh"} label={t("lang.switch")} title={t("lang.label")} />
        {user?.role === "admin" ? <Link className="nav-sell" href="/admin">{t("nav.admin")}</Link> :
          <Link className="nav-sell" href="/sell">{t("nav.sell")}</Link>}
        <Link className="account-link" aria-label={user ? t("nav.account") : t("nav.signIn")} href="/account"><UserRound size={17} /><span>{user ? t("nav.account") : t("nav.signIn")}</span></Link>
      </div>
    </div></header>
    <TabBar labels={{ home: t("nav.home"), explore: t("nav.explore"), sell: user?.role === "admin" ? t("nav.admin") : t("nav.sell"), account: t("nav.account") }} sellHref={user?.role === "admin" ? "/admin" : "/sell"} />
  </>;
}

export function SupportLinks({ t, order }: { t: Translate; order?: string }) {
  const whatsapp = site.whatsapp();
  const email = site.supportEmail();
  if (!whatsapp && !email) return null;
  const subject = order ? `Crazy Monkey order ${shortId(order)}` : "";
  return <div className="support-links">
    {whatsapp && <a className="support-link whatsapp" href={`https://wa.me/${whatsapp}${order ? `?text=${encodeURIComponent(subject)}` : ""}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> {t("support.whatsapp")}</a>}
    {email && <a className="support-link" href={`mailto:${email}${order ? `?subject=${encodeURIComponent(subject)}` : ""}`}><Mail size={17} /> {t("support.email")}</a>}
  </div>;
}

export async function Footer() {
  const { t } = await i18n();
  const terms = site.termsUrl();
  const privacy = site.privacyUrl();
  const groupBuy = site.groupBuyUrl();
  return <footer className="footer"><div className="shell">
    <div className="footer-grid">
      <div className="footer-brand"><Logo t={t} /><p>{t("footer.about")}</p></div>
      <div className="footer-col"><h2>{t("footer.marketplace")}</h2>
        <Link href="/events">{t("nav.explore")}</Link><Link href="/sell">{t("nav.sell")}</Link>
        {groupBuy && <a href={groupBuy}>{t("nav.groupBuy")}</a>}
      </div>
      <div className="footer-col"><h2>{t("footer.help")}</h2>
        <Link href="/how-it-works">{t("nav.how")}</Link><Link href="/account">{t("nav.account")}</Link>
        <SupportLinks t={t} />
      </div>
    </div>
    <div className="copyright"><span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
      <div>{terms && <a href={terms}>{t("footer.terms")}</a>}{privacy && <a href={privacy}>{t("footer.privacy")}</a>}</div></div>
  </div></footer>;
}

export function SearchBar({ t, search = "", category = "", hero = false }: { t: Translate; search?: string; category?: string; hero?: boolean }) {
  return <form className={hero ? "search-bar hero-search" : "search-bar"} action="/events">
    <label className="search-input"><Search size={20} /><span className="sr-only">{t("search.placeholder")}</span>
      <input name="q" placeholder={t("search.placeholder")} defaultValue={search} maxLength={100} />
    </label>
    <label className="select-wrap"><span className="sr-only">{t("search.category")}</span><select name="category" defaultValue={category}>
      <option value="">{t("search.allCategories")}</option>{categories.map((value) => <option key={value} value={value}>{categoryLabel(t, value)}</option>)}
    </select><ChevronDown size={16} /></label>
    <button className="button primary" type="submit" aria-label={t("search.button")}><Search size={17} /><span>{t("search.button")}</span></button>
  </form>;
}

export function CategoryNav({ t, active = "", search = "" }: { t: Translate; active?: string; search?: string }) {
  const options = ["", ...categories] as const;
  return <nav className="category-nav" aria-label={t("search.category")}>
    {options.map((category) => {
      const Icon = category ? categoryIcons[category] : Ticket;
      const query = new URLSearchParams();
      if (search) query.set("q", search);
      if (category) query.set("category", category);
      return <Link key={category} className={category === active ? "category-link selected" : "category-link"} aria-current={category === active ? "page" : undefined}
        href={`/events${query.size ? `?${query}` : ""}`}><Icon size={16} /><span>{categoryLabel(t, category)}</span></Link>;
    })}
  </nav>;
}

export function DateBadge({ value, f }: { value: Date; f: Formatters }) {
  return <span className="date-badge" aria-hidden="true"><small>{f.month(value)}</small><strong>{f.day(value)}</strong></span>;
}

export function EventCard({ item, bps, t, f }: { item: Event; bps: number; t: Translate; f: Formatters }) {
  return <Link href={`/events/${item.slug}`} className="event-card">
    <div className="event-art">
      <img src={posterUrl(item)} alt="" loading="lazy" />
      <DateBadge value={item.starts_at} f={f} />
      <span className="event-category">{categoryLabel(t, item.category)}</span>
    </div>
    <div className="event-copy">
      <p className="event-date"><CalendarDays size={14} /> {f.date(item.starts_at, { weekday: "short", day: "numeric", month: "short" })} · {f.time(item.starts_at)}</p>
      <h3>{item.title}</h3>
      <p className="event-place"><MapPin size={14} /> {item.venue}, {item.city}</p>
    </div>
    <div className="stub">
      {item.lowest === null ? <strong className="sold-out">{t("card.soldOut")}</strong> :
        <><strong className="price">{t("card.from", { price: money(priceWithFee(item.lowest, bps)) })}</strong><span className="on-sale">{t("card.onSale", { count: item.tickets })}</span></>}
    </div>
  </Link>;
}

/** Only dictionary keys are shown, so query strings can't inject arbitrary text. */
export function Notice({ t, error, success }: { t: Translate; error?: string; success?: string }) {
  if (error) return <p className="notice error" role="alert">{t(t.has(error) ? error : "err.generic")}</p>;
  if (success && t.has(success)) return <p className="notice success" role="status">{t(success)}</p>;
  return null;
}

export function Status({ t, value }: { t: Translate; value: string }) {
  const key = `status.${value}`;
  return <span className={`status status-${value}`}>{t.has(key) ? t(key as MessageKey) : value}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><span className="empty-icon"><Ticket size={24} /></span><h3>{title}</h3>{children && <div>{children}</div>}</div>;
}

export function TrustPills({ t, buyer, seller }: { t: Translate; buyer: string; seller: string }) {
  return <ul className="trust-pills">
    <li><ShieldCheck size={17} /> {t("home.trust.escrow")}</li>
    <li><BadgeCheck size={17} /> {t("home.trust.reviewed")}</li>
    <li><Ticket size={17} /> {t("home.trust.fees", { buyer, seller })}</li>
  </ul>;
}
