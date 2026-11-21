import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronDown, CircleHelp, Clapperboard, MapPin, Music2, Search, ShieldCheck, Sparkles, Ticket, Trophy, UserRound } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { categories, date, money, statusLabel } from "@/lib/format";
import { priceWithFee, type Event } from "@/lib/market";

export const categoryIcons = { Concerts: Music2, Festivals: Sparkles, Sports: Trophy, "Arts & Theatre": Clapperboard };

export function Logo() {
  return <Link className="brand" href="/" aria-label="Setlist home"><span className="brand-mark"><Ticket size={22} strokeWidth={2.5} /></span>setlist<span className="brand-dot">.</span></Link>;
}

export async function Header() {
  const user = await currentUser();
  return <header className="topbar"><div className="shell header-inner">
    <Logo />
    <nav aria-label="Main navigation"><Link href="/events">Explore events</Link><Link href="/how-it-works">How it works</Link></nav>
    <div className="nav-actions">
      {user?.role === "admin" ? <Link className="nav-sell" href="/admin">Admin</Link> :
        <Link className="nav-sell" href="/sell">Sell tickets</Link>}
      <Link className="account-link" aria-label={user ? "My account" : "Sign in"} href="/account"><UserRound size={17} /><span>{user ? "My account" : "Sign in"}</span></Link>
    </div>
  </div></header>;
}

function publicPolicyUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function SupportLink({ order }: { order?: string }) {
  const email = process.env.SUPPORT_EMAIL;
  if (!email || !/^[^@\s/?]+@[^@\s/?]+\.[^@\s/?]+$/.test(email)) return null;
  const subject = order ? `?subject=${encodeURIComponent(`Setlist order ${order.slice(0, 8).toUpperCase()}`)}` : "";
  return <a className="text-link" href={`mailto:${email}${subject}`}>Contact support</a>;
}

export function Footer() {
  const terms = publicPolicyUrl(process.env.TERMS_URL);
  const privacy = publicPolicyUrl(process.env.PRIVACY_URL);
  return <footer className="footer"><div className="shell footer-inner">
    <div><Logo /><p>Malaysia’s marketplace for live event tickets.</p></div>
    <div className="footer-links"><Link href="/events">Explore events</Link><Link href="/sell">Sell tickets</Link><Link href="/how-it-works"><CircleHelp size={16} /> Help & ticket transfers</Link></div>
    <div className="copyright"><span>© {new Date().getFullYear()} Setlist</span><div>{terms && <a href={terms}>Terms</a>}{privacy && <a href={privacy}>Privacy</a>}</div></div>
  </div></footer>;
}

export function SearchBar({ search = "", category = "", hero = false }: { search?: string; category?: string; hero?: boolean }) {
  return <form className={hero ? "search-bar hero-search" : "search-bar"} action="/events">
    <label className="search-input"><Search size={21} /><span className="sr-only">Search events, venues or cities</span>
      <input name="q" placeholder="Search events, venues or cities" defaultValue={search} maxLength={100} />
    </label>
    <label className="select-wrap"><span className="sr-only">Event category</span><select name="category" defaultValue={category}>
      <option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}
    </select><ChevronDown size={16} /></label>
    <button className="button primary" type="submit"><span>Search events</span><Search size={17} /></button>
  </form>;
}

export function CategoryNav({ active = "", search = "" }: { active?: string; search?: string }) {
  const options = ["", ...categories] as const;
  return <nav className="category-nav" aria-label="Event categories">
    {options.map((category) => {
      const Icon = category ? categoryIcons[category] : Ticket;
      const query = new URLSearchParams();
      if (search) query.set("q", search);
      if (category) query.set("category", category);
      return <Link key={category} className={category === active ? "category-link selected" : "category-link"} aria-current={category === active ? "page" : undefined}
        href={`/events${query.size ? `?${query}` : ""}`}><Icon size={17} /><span>{category || "All events"}</span></Link>;
    })}
  </nav>;
}

export function EventCard({ item, bps }: { item: Event; bps: number }) {
  return <Link href={`/events/${item.slug}`} className="event-card">
    <div className={`event-art image-${item.image}`}>
      <img src={`/images/${item.image}.webp`} alt="" loading="lazy" />
      <span className="event-category">{item.category}</span>
    </div>
    <div className="event-copy">
      <p className="event-date"><CalendarDays size={15} /> {date(item.starts_at, { weekday: "short", day: "numeric", month: "short" })}</p>
      <h3>{item.title}</h3>
      <p className="event-place"><MapPin size={16} /> {item.venue}, {item.city}</p>
      <div className="event-card-bottom"><div>{item.lowest === null ? <strong>Sold out</strong> : <><span>From</span> <strong>{money(priceWithFee(item.lowest, bps))}</strong></>}</div><span className="card-icon" aria-hidden="true"><ArrowUpRight size={19} /></span></div>
    </div>
  </Link>;
}

export function Notice({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (success) return <p className="notice success" role="status">{success}</p>;
  return null;
}

export function Status({ value }: { value: string }) {
  return <span className={`status status-${value}`}>{statusLabel[value] ?? value}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><span className="empty-icon"><Ticket size={25} /></span><h3>{title}</h3>{children && <div>{children}</div>}</div>;
}

export function TrustStrip() {
  return <div className="trust-strip"><div className="shell trust-inner">
    <div><ShieldCheck size={22} /><span><strong>Reviewed listings</strong><small>Listings are checked before they go live</small></span></div>
    <div><Ticket size={22} /><span><strong>Clear pricing</strong><small>See the total before you pay</small></span></div>
    <div><CircleHelp size={22} /><span><strong>Order support</strong><small>Get help with transfers and refunds</small></span></div>
  </div></div>;
}
