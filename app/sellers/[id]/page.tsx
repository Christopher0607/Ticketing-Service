import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, MessageSquareQuote, Star, Ticket } from "lucide-react";
import { uuid } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { sellerListings, sellerProfile, sellerReviews } from "@/lib/market";
import { Empty, ListingRow, Stars } from "../../ui";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const seller = uuid.test(id) ? await sellerProfile(id) : null;
  return { title: seller?.name ?? "Seller" };
}

/** Public reviewer name: first character plus asterisks. */
const mask = (name: string) => `${Array.from(name)[0] ?? "*"}***`;

export default async function SellerPage({ params }: Params) {
  const [{ id }, { t, f }] = await Promise.all([params, i18n()]);
  if (!uuid.test(id)) notFound();
  const seller = await sellerProfile(id);
  if (!seller) notFound();
  const [listings, reviews] = await Promise.all([sellerListings(id), sellerReviews(id)]);
  return <div className="shell page">
    <section className="panel seller-hero">
      <span className="seller-avatar">{Array.from(seller.name)[0]?.toUpperCase()}</span>
      <div>
        <h1>{seller.name}</h1>
        <p className="seller-verified"><BadgeCheck size={16} /> {t("event.verified")}</p>
        <div className="seller-stats">
          <span><Star size={16} /> {seller.rating !== null ? <><strong>{seller.rating.toFixed(1)}</strong> / 5 · {t("seller.reviewCount", { count: seller.reviews })}</> : t("seller.noRating")}</span>
          <span><Ticket size={16} /> {t("seller.salesCount", { count: seller.sales })}</span>
          <span><CalendarDays size={16} /> {t("seller.joined", { date: f.date(seller.created_at, { month: "long", year: "numeric" }) })}</span>
        </div>
      </div>
    </section>
    <div className="detail-grid">
      <section>
        <div className="section-header compact"><div><h2>{t("seller.onSale")}</h2></div></div>
        {listings.length ? <div className="panel listing-rows">{listings.map((item) => <ListingRow key={item.id} item={item} t={t} f={f} />)}</div> :
          <Empty title={t("seller.noListingsPublic")} />}
      </section>
      <aside className="panel reviews">
        <h2><MessageSquareQuote size={20} /> {t("seller.reviews")}</h2>
        {!reviews.length && <p className="muted">{t("seller.noReviews")}</p>}
        {reviews.map((review, index) => <article key={index} className="review">
          <div className="review-head"><Stars value={review.rating} /><strong>{mask(review.buyer)}</strong><small>{f.date(review.created_at, { day: "numeric", month: "short", year: "numeric" })}</small></div>
          {review.comment && <p className="wrap">{review.comment}</p>}
          <small className="review-event">{review.title}</small>
        </article>)}
      </aside>
    </div>
  </div>;
}
