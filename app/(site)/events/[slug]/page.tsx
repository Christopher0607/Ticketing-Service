import { CalendarDays, ChevronLeft, Clock3, ExternalLink, Heart, Hourglass, Map as MapIcon, MapPin, Navigation, ShieldCheck, Tag, Ticket } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { appUrl, paymentMode } from "@/lib/config";
import { markupBps, mediaUrl, money, percent, percentRounded, posterUrl } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { event, eventListings, fees, isFavorite, priceWithFee, similarEvents } from "@/lib/market";
import { releaseExpired } from "@/lib/orders";
import { startCheckout, toggleFavorite } from "@/app/actions";
import { DateBadge, Empty, EventCard, Notice, SellerBadge, ShareBar, categoryLabel } from "@/app/ui";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; qty?: string; sort?: string }> };

export async function generateMetadata({ params }: Params) {
  const item = await event((await params).slug);
  if (!item) return { title: "Event" };
  return { title: item.title, description: item.description.slice(0, 160), openGraph: { title: item.title, images: [posterUrl(item)] } };
}

function siteUrl() {
  try { return appUrl(); } catch { return "http://localhost:3000"; }
}

export default async function Detail({ params, searchParams }: Params) {
  const [{ slug }, query, user, { t, f }] = await Promise.all([params, searchParams, currentUser(), i18n()]);
  await releaseExpired();
  const item = await event(slug);
  if (!item) notFound();
  const quantity = Math.min(10, Math.max(1, Number.parseInt(query.qty ?? "1", 10) || 1));
  const sort = query.sort === "desc" ? "desc" : "asc";
  const available = item.starts_at.getTime() > Date.now() + 2700000;
  const [listings, similar, saved, settings] = await Promise.all([
    available ? eventListings(item.id, { sort, quantity }) : Promise.resolve([]),
    similarEvents(item),
    user ? isFavorite(user.id, item.id) : Promise.resolve(false),
    fees(),
  ]);
  const mode = paymentMode();
  const buyerBps = settings.buyer_bps;
  const days = Math.ceil((item.starts_at.getTime() - Date.now()) / 86400000);
  const place = [item.venue, item.venue_address, item.city].filter(Boolean).join(", ");
  const url = `${siteUrl()}/events/${item.slug}`;
  const filterHref = (changes: { qty?: number; sort?: string }) => {
    const next = new URLSearchParams();
    const qty = changes.qty ?? quantity;
    const order = changes.sort ?? sort;
    if (qty > 1) next.set("qty", String(qty));
    if (order === "desc") next.set("sort", "desc");
    return `/events/${item.slug}${next.size ? `?${next}` : ""}#tickets`;
  };
  const structured = {
    "@context": "https://schema.org", "@type": "Event", name: item.title, description: item.description,
    startDate: new Date(item.starts_at).toISOString(), eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", image: [new URL(posterUrl(item), siteUrl()).href],
    location: { "@type": "Place", name: item.venue, address: { "@type": "PostalAddress", streetAddress: item.venue_address ?? undefined, addressLocality: item.city, addressCountry: "MY" } },
    ...(item.lowest !== null ? { offers: { "@type": "AggregateOffer", priceCurrency: "MYR", lowPrice: (priceWithFee(item.lowest, buyerBps) / 100).toFixed(2), offerCount: listings.length, availability: "https://schema.org/InStock", url } } : {}),
  };
  return <div className="page event-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />
    <section className="event-hero">
      <div className="event-hero-bg" aria-hidden="true"><img src={posterUrl(item)} alt="" /></div>
      <div className="shell event-hero-inner">
        <Link className="back-link" href="/events"><ChevronLeft size={18} /> {t("event.back")}</Link>
        <div className="event-hero-grid">
          <div className="event-poster"><img src={posterUrl(item)} alt={item.title} /><DateBadge value={item.starts_at} f={f} /></div>
          <div className="event-hero-copy">
            <div className="hero-tags"><span className="event-category">{categoryLabel(t, item.category)}</span>
              {days > 0 && <span className="countdown-tag"><Hourglass size={13} /> {days === 1 ? t("event.tomorrow") : t("event.daysLeft", { days })}</span>}</div>
            <h1>{item.title}</h1>
            <div className="detail-meta">
              <span><CalendarDays size={18} /> {f.date(item.starts_at)}</span>
              <span><Clock3 size={18} /> {f.time(item.starts_at)} MYT</span>
              <span><MapPin size={18} /> {item.venue}, {item.city}</span>
            </div>
            {item.lowest !== null && <p className="hero-price">{t("card.from", { price: money(priceWithFee(item.lowest, buyerBps)) })}</p>}
            <div className="hero-actions">
              {listings.length > 0 && <a className="button primary" href="#tickets"><Ticket size={17} /> {t("event.seeTickets", { count: listings.length })}</a>}
              <form action={toggleFavorite}><input type="hidden" name="event" value={item.id} /><input type="hidden" name="slug" value={item.slug} />
                <button className={saved ? "button outline saved" : "button outline"} aria-pressed={saved}><Heart size={17} /> {saved ? t("event.saved") : t("event.save")}</button></form>
            </div>
            <ShareBar t={t} url={url} title={item.title} />
          </div>
        </div>
      </div>
    </section>
    <div className="shell detail-grid">
      <section>
        <div className="section-header compact" id="tickets"><div><h2>{t("event.available")}</h2>
          <p>{t("event.priceNote", { fee: percent(buyerBps) })}</p></div></div>
        {available && <div className="ticket-filters">
          <div className="segmented" aria-label={t("event.howMany")}><span>{t("event.howMany")}</span>
            {[1, 2, 3, 4].map((n) => <Link key={n} href={filterHref({ qty: n })} className={quantity === n ? "active" : undefined} aria-current={quantity === n ? "true" : undefined}>{n === 4 ? "4+" : n}</Link>)}</div>
          <div className="segmented"><span>{t("filter.sort")}</span>
            <Link href={filterHref({ sort: "asc" })} className={sort === "asc" ? "active" : undefined}>{t("event.priceLow")}</Link>
            <Link href={filterHref({ sort: "desc" })} className={sort === "desc" ? "active" : undefined}>{t("event.priceHigh")}</Link></div>
        </div>}
        <Notice t={t} error={query.error ?? (listings.length && !mode ? "err.checkoutUnavailable" : undefined)} />
        {!listings.length ? <Empty title={available ? (quantity > 1 ? t("event.noTicketsQty", { count: quantity }) : t("event.noTickets")) : t("event.closed")}>
          {available && !saved && <p className="muted">{t("event.saveHint")}</p>}
          <Link className="button outline" href="/events">{t("event.exploreOther")}</Link></Empty> :
          <div className="listing-list">{listings.map((listing) => {
            const markup = listing.face_value ? markupBps(listing.price, listing.face_value) : null;
            return <article key={listing.id} className="listing">
              <div className="listing-info">
                <h3><Ticket size={18} /> {listing.section}</h3>
                <p className="listing-seller"><SellerBadge t={t} seller={listing.seller} id={listing.seller_id} rating={listing.rating} reviews={listing.reviews} sales={listing.sales} />
                  <span>· {t("event.left", { count: listing.available })}</span></p>
                {listing.face_value !== null && <p className="listing-face">
                  <span>{t("event.faceValue", { price: money(listing.face_value) })}</span>
                  {markup !== null && <span className={markup <= 0 ? "face-badge good" : "face-badge"}><Tag size={12} /> {markup <= 0 ? t("event.atFace") : t("event.markup", { pct: percentRounded(markup) })}</span>}
                </p>}
              </div>
              <form action={startCheckout} className="listing-buy">
                <input type="hidden" name="id" value={listing.id} /><input type="hidden" name="slug" value={item.slug} />
                <p className="listing-price"><strong>{money(priceWithFee(listing.price, listing.buyer_bps))}</strong> <small>{t("event.perTicket")}</small></p>
                <div className="listing-actions">
                  <label className="qty"><span className="sr-only">{t("event.quantity", { section: listing.section })}</span>
                    <select name="quantity" defaultValue={Math.min(quantity, listing.available)}>{Array.from({ length: Math.min(10, listing.available) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
                  <button className="button primary" disabled={!mode}>{t("event.select")}</button>
                </div>
              </form>
            </article>;
          })}</div>}
        {item.seatmap_id && <div className="panel seatmap"><h2><MapIcon size={20} /> {t("event.seatmap")}</h2>
          <a href={mediaUrl(item.seatmap_id, item.seatmap_remote)} target="_blank" rel="noreferrer"><img src={mediaUrl(item.seatmap_id, item.seatmap_remote)} alt={t("event.seatmap")} loading="lazy" /></a></div>}
        <div className="panel about-event"><h2>{t("event.about")}</h2><p className="wrap">{item.description}</p></div>
        <div className="panel venue"><h2><MapPin size={20} /> {t("event.venue")}</h2>
          <p><strong>{item.venue}</strong><br />{[item.venue_address, item.city].filter(Boolean).join(", ")}</p>
          <div className="inline-form">
            <a className="button outline small" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`} target="_blank" rel="noreferrer"><MapIcon size={15} /> Google Maps</a>
            <a className="button outline small" href={`https://waze.com/ul?q=${encodeURIComponent(place)}&navigate=yes`} target="_blank" rel="noreferrer"><Navigation size={15} /> Waze</a>
          </div>
        </div>
      </section>
      <aside className="side-stack">
        <div className="panel guarantee"><h2><ShieldCheck size={20} /> {t("event.guarantee")}</h2>
          <ul><li>{t("event.g1")}</li><li>{t("event.g2")}</li><li>{t("event.g3")}</li></ul>
          <Link className="text-link" href="/legal/refunds">{t("event.guaranteeLink")}</Link>
        </div>
        <div className="panel"><h3><Ticket size={18} /> {t("event.transfer")}</h3><p>{t("event.transferBody")}</p>
          {item.transfer_policy_url && <a className="text-link" href={item.transfer_policy_url} target="_blank" rel="noreferrer">{t("event.policy")} <ExternalLink size={14} /></a>}
        </div>
        {available && <div className="panel sell-yours"><p>{t("event.sellYours")}</p><Link className="button outline small" href="/sell">{t("event.sellCta")}</Link></div>}
      </aside>
    </div>
    {similar.length > 0 && <section className="shell home-section">
      <div className="section-header"><div><h2>{t("event.similar")}</h2></div></div>
      <div className="event-grid">{similar.map((other) => <EventCard key={other.id} item={other} bps={buyerBps} t={t} f={f} />)}</div>
    </section>}
  </div>;
}
