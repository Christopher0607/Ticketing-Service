import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, CreditCard, Flame, MapPin, ShieldCheck, Ticket, Wallet } from "lucide-react";
import { appUrl, site } from "@/lib/config";
import { money, posterUrl, type Category } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { categoryCounts, cities, events, fees, latestListings, priceWithFee, spotlight } from "@/lib/market";
import { HeroCarousel, type Slide } from "@/app/client";
import { CategoryTiles, Empty, EventCard, ListingRow, SearchBar, SectionHead, TrustPills, categoryLabel } from "@/app/ui";

export default async function Home() {
  const [featured, upcoming, popular, latest, counts, places, settings, { t, f }] = await Promise.all([
    spotlight(5), events({ limit: 8 }), events({ sort: "popular", limit: 8 }), latestListings(6), categoryCounts(), cities(), fees(), i18n(),
  ]);
  const groupBuy = site.groupBuyUrl();
  const slides: Slide[] = featured.map((item) => ({
    href: `/events/${item.slug}`, title: item.title, poster: posterUrl(item),
    kicker: item.featured ? t("home.featured") : categoryLabel(t, item.category),
    meta: [`${f.date(item.starts_at, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${f.time(item.starts_at)}`, `${item.venue}, ${item.city}`],
    price: item.lowest === null ? null : t("card.from", { price: money(priceWithFee(item.lowest, settings.buyer_bps)) }),
    cta: t("home.buyNow"),
  }));
  const trending = popular.filter((item) => item.score > 0 || item.tickets > 0);
  const steps = [
    [CreditCard, "home.step1.title", "home.step1.body"],
    [Ticket, "home.step2.title", "home.step2.body"],
    [BadgeCheck, "home.step3.title", "home.step3.body"],
    [Wallet, "home.step4.title", "home.step4.body"],
  ] as const;
  const faq = [["how.q4", "how.a4"], ["how.q2", "how.a2"], ["how.q5", "how.a5"], ["how.q7", "how.a7"]] as const;
  // Tells search engines the site's name and logo (shown next to it in results).
  let origin = "https://crazymonkeyticketing.com";
  try { origin = appUrl(); } catch { /* local default */ }
  const structured = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "Crazy Monkey Ticketing", alternateName: ["Crazy Monkey 票务", "Crazy Monkey"], url: `${origin}/` },
    { "@context": "https://schema.org", "@type": "Organization", name: "Crazy Monkey Ticketing", url: `${origin}/`, logo: `${origin}/logo.png`, sameAs: site.socialProfiles },
  ];
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    {slides.length > 0 ? <HeroCarousel slides={slides} label={t("home.featured")} previous={t("home.prev")} next={t("home.next")} /> :
      <div className="hero hero-compact"><div className="hero-art" aria-hidden="true"><img src="/images/hero.webp" alt="" /></div></div>}

    <section className="search-band">
      <div className="shell search-band-inner">
        <p className="kicker"><span className="pulse" /> {t("home.kicker")}</p>
        <h1 className="brand-title">{t("home.title1")} <em>{t("home.title2")}</em></h1>
        <SearchBar t={t} hero />
        <TrustPills t={t} />
      </div>
    </section>

    <section className="shell home-section" aria-labelledby="browse">
      <SectionHead id="browse" title={t("home.browse")} lead={t("home.browseLead")} />
      <CategoryTiles t={t} counts={Object.fromEntries(counts.map((row) => [row.category, row.count])) as Partial<Record<Category, number>>} />
    </section>

    {trending.length > 0 && <section className="shell home-section" aria-labelledby="trending">
      <SectionHead id="trending" title={t("home.trending")} lead={t("home.trendingLead")} href="/events?sort=popular" linkLabel={t("home.viewAll")} />
      <div className="scroller">{trending.map((item) => <EventCard key={item.id} item={item} bps={settings.buyer_bps} t={t} f={f} />)}</div>
    </section>}

    <section className="shell home-section" aria-labelledby="upcoming">
      <SectionHead id="upcoming" title={t("home.upcoming")} lead={t("home.upcomingLead")} href="/events" linkLabel={t("home.viewAll")} />
      {upcoming.length ? <div className="event-grid">{upcoming.map((item) => <EventCard key={item.id} item={item} bps={settings.buyer_bps} t={t} f={f} />)}</div> :
        <Empty title={t("home.empty")} />}
    </section>

    {(latest.length > 0 || places.length > 0) && <section className="shell home-section two-col">
      {latest.length > 0 && <div className="panel latest">
        <h2><Flame size={20} /> {t("home.latest")}</h2>
        <div className="listing-rows">{latest.map((item) => <ListingRow key={item.id} item={item} t={t} f={f} />)}</div>
      </div>}
      {places.length > 0 && <div className="panel cities">
        <h2><MapPin size={20} /> {t("home.cities")}</h2>
        <div className="city-chips">{places.map((place) => <Link key={place.city} href={`/events?city=${encodeURIComponent(place.city)}`} className="city-chip">
          <span>{place.city}</span><small>{place.count}</small></Link>)}</div>
        <Link href="/events?when=weekend" className="weekend-link">{t("home.weekend")} <ArrowRight size={16} /></Link>
      </div>}
    </section>}

    <section className="band escrow" aria-labelledby="escrow">
      <div className="shell">
        <p className="kicker"><ShieldCheck size={15} /> {t("home.escrow.kicker")}</p>
        <h2 id="escrow" className="band-title">{t("home.escrow.title")}</h2>
        <ol className="steps">{steps.map(([Icon, title, body], index) => <li key={title}>
          <span className="step-number" data-step={`0${index + 1}`} aria-hidden="true" /><Icon size={24} className="step-icon" />
          <h3>{t(title)}</h3><p>{t(body)}</p>
        </li>)}</ol>
        <Link href="/legal/refunds" className="text-link">{t("home.guaranteeLink")} <ArrowRight size={15} /></Link>
      </div>
    </section>


    <section className="shell home-section faq-preview" aria-labelledby="faq">
      <SectionHead id="faq" title={t("how.faq")} href="/how-it-works" linkLabel={t("home.moreFaq")} />
      <div className="faq-grid">{faq.map(([q, a]) => <details key={q} className="panel"><summary>{t(q)}</summary><p>{t(a)}</p></details>)}</div>
    </section>

    <section className="shell cta-grid">
      <div className="cta-card">
        <img src="/logo-384.webp" alt="" className="cta-logo" width={120} height={120} />
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
