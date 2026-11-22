import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, CreditCard, MapPin, ShieldCheck, Ticket, Wallet } from "lucide-react";
import { site } from "@/lib/config";
import { fee, money, percent, posterUrl } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { events, fees, priceWithFee } from "@/lib/market";
import { CategoryNav, Empty, EventCard, SearchBar, TrustPills } from "./ui";

export default async function Home() {
  const [catalogue, settings, { t, f }] = await Promise.all([events(), fees(), i18n()]);
  const featured = catalogue.find((item) => item.featured && item.tickets > 0) ?? catalogue.find((item) => item.tickets > 0);
  const upcoming = catalogue.slice(0, 8);
  const buyer = percent(settings.buyer_bps);
  const seller = percent(settings.seller_bps);
  const example = 30000;
  const groupBuy = site.groupBuyUrl();
  const steps = [
    [CreditCard, "home.step1.title", "home.step1.body"],
    [Ticket, "home.step2.title", "home.step2.body"],
    [BadgeCheck, "home.step3.title", "home.step3.body"],
    [Wallet, "home.step4.title", "home.step4.body"],
  ] as const;
  return <>
    <section className="hero">
      <div className="hero-art" aria-hidden="true"><img src="/images/hero.webp" alt="" /></div>
      <div className="shell hero-inner">
        <div className="hero-content">
          <p className="kicker"><span className="pulse" /> {t("home.kicker")}</p>
          <h1>{t("home.title1")}<br /><em>{t("home.title2")}</em></h1>
          <p className="hero-lead">{t("home.lead")}</p>
          <SearchBar t={t} hero />
          <TrustPills t={t} buyer={buyer} seller={seller} />
        </div>
        {featured && <Link href={`/events/${featured.slug}`} className="featured-ticket">
          <div className="featured-poster"><img src={posterUrl(featured)} alt="" /></div>
          <div className="featured-body">
            <span className="featured-label"><Ticket size={14} /> {t("home.featured")}</span>
            <h2>{featured.title}</h2>
            <p><CalendarDays size={15} /> {f.date(featured.starts_at, { weekday: "short", day: "numeric", month: "short" })} · {f.time(featured.starts_at)}</p>
            <p><MapPin size={15} /> {featured.venue}</p>
          </div>
          <div className="featured-stub">
            {featured.lowest !== null && <strong>{t("card.from", { price: money(priceWithFee(featured.lowest, settings.buyer_bps)) })}</strong>}
            <span className="round-icon" aria-hidden="true"><ArrowUpRight size={20} /></span>
          </div>
        </Link>}
      </div>
    </section>

    <section className="shell discovery" aria-labelledby="upcoming">
      <CategoryNav t={t} />
      <div className="section-header"><div><h2 id="upcoming">{t("home.upcoming")}</h2><p>{t("home.upcomingLead")}</p></div>
        <Link href="/events" className="button outline">{t("home.viewAll")} <ArrowRight size={16} /></Link></div>
      {upcoming.length ? <div className="event-grid">{upcoming.map((item) => <EventCard key={item.id} item={item} bps={settings.buyer_bps} t={t} f={f} />)}</div> :
        <Empty title={t("home.empty")} />}
    </section>

    <section className="band escrow" aria-labelledby="escrow">
      <div className="shell">
        <p className="kicker"><ShieldCheck size={15} /> {t("home.escrow.kicker")}</p>
        <h2 id="escrow" className="band-title">{t("home.escrow.title")}</h2>
        <ol className="steps">{steps.map(([Icon, title, body], index) => <li key={title}>
          <span className="step-number">0{index + 1}</span><Icon size={24} className="step-icon" />
          <h3>{t(title)}</h3><p>{t(body)}</p>
        </li>)}</ol>
      </div>
    </section>

    <section className="shell fees" aria-labelledby="fees">
      <div className="fees-copy">
        <p className="kicker">{t("home.fees.kicker")}</p>
        <h2 id="fees">{t("home.fees.title")}</h2>
        <p>{t("home.fees.body", { buyer, seller })}</p>
        <div className="fee-rates"><span><strong>{buyer}</strong>{t("home.fees.buyerFee")}</span><span><strong>{seller}</strong>{t("home.fees.sellerFee")}</span></div>
      </div>
      <div className="fee-ticket" aria-label={t("home.fees.example", { price: money(example) })}>
        <p className="fee-ticket-title">{t("home.fees.example", { price: money(example) })}</p>
        <dl>
          <div><dt>{t("home.fees.ticket")}</dt><dd>{money(example)}</dd></div>
          <div><dt>{t("home.fees.buyerPays")}</dt><dd className="gold">{money(priceWithFee(example, settings.buyer_bps))}</dd></div>
          <div><dt>{t("home.fees.sellerGets")}</dt><dd>{money(example - fee(example, settings.seller_bps))}</dd></div>
        </dl>
      </div>
    </section>

    <section className="shell cta-grid">
      <div className="cta-card">
        <img src="/logo.png" alt="" className="cta-logo" width={120} height={120} />
        <div><h2>{t("home.sell.title")}</h2><p>{t("home.sell.body")}</p></div>
        <Link href="/sell" className="button primary">{t("home.sell.cta")} <ArrowRight size={16} /></Link>
      </div>
      {groupBuy && <div className="cta-card alt">
        <div><h2>{t("home.group.title")}</h2><p>{t("home.group.body")}</p></div>
        <a href={groupBuy} className="button outline">{t("home.group.cta")} <ArrowUpRight size={16} /></a>
      </div>}
    </section>
  </>;
}
