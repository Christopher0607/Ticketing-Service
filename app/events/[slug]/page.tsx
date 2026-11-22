import { BadgeCheck, CalendarDays, ChevronLeft, Clock3, ExternalLink, MapPin, ShieldCheck, Tag, Ticket } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { markupBps, money, percent, posterUrl } from "@/lib/format";
import { paymentMode } from "@/lib/config";
import { i18n } from "@/lib/i18n";
import { event, eventListings, priceWithFee } from "@/lib/market";
import { startCheckout } from "../../actions";
import { DateBadge, Empty, Notice, categoryLabel } from "../../ui";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> };
export async function generateMetadata({ params }: Params) {
  const item = await event((await params).slug);
  return item ? { title: item.title, description: item.description.slice(0, 160), openGraph: { images: [posterUrl(item)] } } : { title: "Event" };
}

export default async function Detail({ params, searchParams }: Params) {
  const [item, { error }, { t, f }] = await Promise.all([params.then(({ slug }) => event(slug)), searchParams, i18n()]);
  if (!item) notFound();
  const available = item.starts_at.getTime() > Date.now() + 2700000;
  const listings = available ? await eventListings(item.id) : [];
  const mode = paymentMode();
  const buyerBps = listings[0]?.buyer_bps;
  return <div className="page event-page">
    <section className="event-hero">
      <div className="event-hero-bg" aria-hidden="true"><img src={posterUrl(item)} alt="" /></div>
      <div className="shell event-hero-inner">
        <Link className="back-link" href="/events"><ChevronLeft size={18} /> {t("event.back")}</Link>
        <div className="event-hero-grid">
          <div className="event-poster"><img src={posterUrl(item)} alt={item.title} /><DateBadge value={item.starts_at} f={f} /></div>
          <div className="event-hero-copy">
            <span className="event-category">{categoryLabel(t, item.category)}</span>
            <h1>{item.title}</h1>
            <div className="detail-meta">
              <span><CalendarDays size={18} /> {f.date(item.starts_at)}</span>
              <span><Clock3 size={18} /> {f.time(item.starts_at)} MYT</span>
              <span><MapPin size={18} /> {item.venue}, {item.city}</span>
            </div>
            {item.lowest !== null && buyerBps !== undefined && <p className="hero-price">{t("card.from", { price: money(priceWithFee(item.lowest, buyerBps)) })}</p>}
          </div>
        </div>
      </div>
    </section>
    <div className="shell detail-grid">
      <section>
        <div className="section-header compact"><div><h2>{t("event.available")}</h2>
          {buyerBps !== undefined && <p>{t("event.priceNote", { fee: percent(buyerBps) })}</p>}</div></div>
        <Notice t={t} error={error ?? (listings.length && !mode ? "err.checkoutUnavailable" : undefined)} />
        {!listings.length ? <Empty title={available ? t("event.noTickets") : t("event.closed")}><Link className="button outline" href="/events">{t("event.exploreOther")}</Link></Empty> :
          <div className="listing-list">{listings.map((listing) => {
            const markup = listing.face_value ? markupBps(listing.price, listing.face_value) : null;
            return <article key={listing.id} className="listing">
              <div className="listing-info">
                <h3><Ticket size={18} /> {listing.section}</h3>
                <p className="listing-seller"><BadgeCheck size={15} /> {t("event.seller", { name: listing.seller })} · {t("event.left", { count: listing.available })}</p>
                {listing.face_value !== null && <p className="listing-face">
                  <span>{t("event.faceValue", { price: money(listing.face_value) })}</span>
                  {markup !== null && <span className={markup <= 0 ? "face-badge good" : "face-badge"}><Tag size={12} /> {markup <= 0 ? t("event.atFace") : t("event.markup", { pct: percent(markup) })}</span>}
                </p>}
              </div>
              <form action={startCheckout} className="listing-buy">
                <input type="hidden" name="id" value={listing.id} /><input type="hidden" name="slug" value={item.slug} />
                <p className="listing-price"><strong>{money(priceWithFee(listing.price, listing.buyer_bps))}</strong> <small>{t("event.perTicket")}</small></p>
                <div className="listing-actions">
                  <label className="qty"><span className="sr-only">{t("event.quantity", { section: listing.section })}</span><select name="quantity">{Array.from({ length: Math.min(10, listing.available) }, (_, i) => <option key={i}>{i + 1}</option>)}</select></label>
                  <button className="button primary" disabled={!mode}>{t("event.select")}</button>
                </div>
              </form>
            </article>;
          })}</div>}
        <div className="panel about-event"><h2>{t("event.about")}</h2><p className="wrap">{item.description}</p></div>
      </section>
      <aside className="side-stack">
        <div className="panel guarantee"><h2><ShieldCheck size={20} /> {t("event.guarantee")}</h2>
          <ul><li>{t("event.g1")}</li><li>{t("event.g2")}</li><li>{t("event.g3")}</li></ul>
        </div>
        <div className="panel"><h3><Ticket size={18} /> {t("event.transfer")}</h3><p>{t("event.transferBody")}</p>
          {item.transfer_policy_url && <a className="text-link" href={item.transfer_policy_url} target="_blank" rel="noreferrer">{t("event.policy")} <ExternalLink size={14} /></a>}
        </div>
        {available && <div className="panel sell-yours"><p>{t("event.sellYours")}</p><Link className="button outline small" href="/sell">{t("event.sellCta")}</Link></div>}
      </aside>
    </div>
  </div>;
}
