import { query } from "./db";
import { configuredMode, sellerReady } from "./config";
import { fee, type Category, type EventImage } from "./format";

export type Event = {
  id: string; slug: string; title: string; category: Category; venue: string; city: string; venue_address: string | null;
  starts_at: Date; description: string; image: EventImage; poster_id: string | null; seatmap_id: string | null; featured: boolean;
  poster_remote: boolean | null; seatmap_remote: boolean | null;
  transfer_policy_url: string | null; transfer_host: string | null;
  lowest: number | null; tickets: number; fans: number; score: number;
};

// $1 is always the payment mode, used to decide which sellers' listings count.
export const remoteFlags = `(SELECT m.remote FROM media m WHERE m.id=e.poster_id) AS poster_remote,
  (SELECT m.remote FROM media m WHERE m.id=e.seatmap_id) AS seatmap_remote`;

const eventFields = `e.*, ${remoteFlags}, (
  SELECT min(l.price) FROM listings l JOIN users s ON s.id=l.seller_id
  WHERE l.event_id=e.id AND l.status='active' AND l.available>0 AND ${sellerReady("$1")}
) AS lowest, (
  SELECT coalesce(sum(l.available),0)::int FROM listings l JOIN users s ON s.id=l.seller_id
  WHERE l.event_id=e.id AND l.status='active' AND ${sellerReady("$1")}
) AS tickets,
(SELECT count(*)::int FROM favorites f WHERE f.event_id=e.id) AS fans,
(SELECT count(*)::int FROM orders o JOIN listings l2 ON l2.id=o.listing_id
  WHERE l2.event_id=e.id AND o.status IN ('paid','delivered','confirmed') AND o.created_at>now()-interval '30 days') * 3
  + (SELECT count(*)::int FROM favorites f WHERE f.event_id=e.id) AS score`;

export const whenOptions = ["", "today", "weekend", "week", "month"] as const;
export const sortOptions = ["date", "price", "popular"] as const;
export type When = (typeof whenOptions)[number];
export type Sort = (typeof sortOptions)[number];
export type EventFilters = { search?: string; category?: string; city?: string; when?: When; sort?: Sort; page?: number; limit?: number };

/** Date windows in Malaysia time (UTC+8, no daylight saving). */
export function dateRange(when: When, now = Date.now()): [Date | null, Date | null] {
  const offset = 8 * 3600000;
  const day = 86400000;
  const local = now + offset;
  const midnight = local - (local % day) - offset;
  const weekday = new Date(local).getUTCDay();
  if (when === "today") return [new Date(now), new Date(midnight + day)];
  if (when === "weekend") {
    const saturday = weekday === 6 ? midnight : weekday === 0 ? midnight - day : midnight + (6 - weekday) * day;
    return [new Date(Math.max(now, saturday)), new Date(saturday + 2 * day)];
  }
  if (when === "week") return [new Date(now), new Date(now + 7 * day)];
  if (when === "month") return [new Date(now), new Date(now + 30 * day)];
  return [null, null];
}

const filterClause = `e.active AND e.starts_at>now()
  AND ($2='' OR strpos(lower(e.title||' '||e.venue||' '||e.city),lower($2))>0)
  AND ($3='' OR e.category=$3)
  AND ($4='' OR lower(e.city)=lower($4))
  AND ($5::timestamptz IS NULL OR e.starts_at>=$5)
  AND ($6::timestamptz IS NULL OR e.starts_at<$6)`;

function filterValues(filters: EventFilters) {
  const { search = "", category = "", city = "", when = "" } = filters;
  const [from, to] = dateRange(when);
  return [configuredMode(), search, category, city, from, to];
}

export async function events(filters: EventFilters = {}) {
  const { sort = "date", page = 1, limit = 200 } = filters;
  const order = { date: "x.starts_at, x.id", price: "x.lowest ASC NULLS LAST, x.starts_at", popular: "x.score DESC, x.starts_at" }[sort];
  return query<Event>(`SELECT * FROM (SELECT ${eventFields} FROM events e WHERE ${filterClause}) x
    ORDER BY ${order} LIMIT $7 OFFSET $8`, [...filterValues(filters), limit, (Math.max(1, page) - 1) * limit]);
}

export async function eventCount(filters: EventFilters = {}) {
  const [row] = await query<{ count: number }>(`SELECT count(*)::int AS count FROM events e WHERE ${filterClause} AND $1::text IS NOT NULL`, filterValues(filters));
  return row.count;
}

/** Featured events first, then the most in-demand events that have tickets. */
export function spotlight(limit = 5) {
  return query<Event>(`SELECT * FROM (SELECT ${eventFields} FROM events e WHERE e.active AND e.starts_at>now()) x
    WHERE x.featured OR x.tickets>0 ORDER BY x.featured DESC, x.score DESC, x.starts_at LIMIT $2`, [configuredMode(), limit]);
}

export async function event(slug: string) {
  const [item] = await query<Event>(`SELECT ${eventFields} FROM events e WHERE e.active AND e.slug=$2`, [configuredMode(), slug]);
  return item ?? null;
}

export function similarEvents(item: Pick<Event, "id" | "category">, limit = 4) {
  return query<Event>(`SELECT ${eventFields} FROM events e WHERE e.active AND e.starts_at>now() AND e.category=$2 AND e.id<>$3
    ORDER BY e.starts_at LIMIT $4`, [configuredMode(), item.category, item.id, limit]);
}

export function categoryCounts() {
  return query<{ category: Category; count: number }>(`SELECT category,count(*)::int AS count FROM events
    WHERE active AND starts_at>now() GROUP BY category`);
}

export function cities() {
  return query<{ city: string; count: number }>(`SELECT min(city) AS city,count(*)::int AS count FROM events
    WHERE active AND starts_at>now() GROUP BY lower(city) ORDER BY count(*) DESC, min(city) LIMIT 12`);
}

export type PublicListing = {
  id: string; section: string; price: number; face_value: number | null; available: number; buyer_bps: number;
  seller_id: string; seller: string; rating: number | null; reviews: number; sales: number;
};

const sellerStats = `LEFT JOIN LATERAL (SELECT round(avg(r.rating)::numeric,1)::float AS rating,count(*)::int AS reviews
    FROM reviews r WHERE r.seller_id=s.id) rv ON true
  LEFT JOIN LATERAL (SELECT count(*)::int AS sales FROM orders o JOIN listings ol ON ol.id=o.listing_id
    WHERE ol.seller_id=s.id AND o.status='confirmed') sv ON true`;

export function eventListings(id: string, options: { sort?: "asc" | "desc"; quantity?: number } = {}) {
  const direction = options.sort === "desc" ? "DESC" : "ASC";
  return query<PublicListing>(`
    SELECT l.id,l.section,l.price,l.face_value,l.available,f.buyer_bps,s.id AS seller_id,s.name AS seller,
      rv.rating,rv.reviews,sv.sales
    FROM listings l JOIN users s ON s.id=l.seller_id CROSS JOIN fee_settings f ${sellerStats}
    WHERE l.event_id=$1 AND l.status='active' AND l.available>=$3 AND ${sellerReady("$2")}
    ORDER BY l.price ${direction},l.id`, [id, configuredMode(), Math.max(1, options.quantity ?? 1)]);
}

export type ListingCard = {
  id: string; section: string; price: number; face_value: number | null; available: number; buyer_bps: number; seller: string;
  slug: string; title: string; starts_at: Date; venue: string; image: string; poster_id: string | null; poster_remote: boolean | null;
};

const listingCardFields = `l.id,l.section,l.price,l.face_value,l.available,f.buyer_bps,s.name AS seller,
  e.slug,e.title,e.starts_at,e.venue,e.image,e.poster_id,(SELECT m.remote FROM media m WHERE m.id=e.poster_id) AS poster_remote
  FROM listings l JOIN events e ON e.id=l.event_id JOIN users s ON s.id=l.seller_id CROSS JOIN fee_settings f
  WHERE l.status='active' AND l.available>0 AND e.active AND e.starts_at>now() AND ${sellerReady("$1")}`;

export function latestListings(limit = 6) {
  return query<ListingCard>(`SELECT ${listingCardFields} ORDER BY l.updated_at DESC LIMIT $2`, [configuredMode(), limit]);
}

export type SellerProfile = { id: string; name: string; created_at: Date; sales: number; rating: number | null; reviews: number };

export async function sellerProfile(id: string) {
  const [seller] = await query<SellerProfile>(`SELECT s.id,s.name,s.created_at,sv.sales,rv.rating,rv.reviews
    FROM users s ${sellerStats} WHERE s.id=$1 AND s.role='seller' AND s.banned_at IS NULL`, [id]);
  return seller ?? null;
}

export function sellerListings(id: string) {
  return query<ListingCard>(`SELECT ${listingCardFields} AND s.id=$2 ORDER BY e.starts_at LIMIT 50`, [configuredMode(), id]);
}

export function sellerReviews(id: string, limit = 20) {
  return query<{ rating: number; comment: string | null; created_at: Date; buyer: string; title: string }>(`
    SELECT r.rating,r.comment,r.created_at,u.name AS buyer,e.title FROM reviews r JOIN users u ON u.id=r.buyer_id
    JOIN orders o ON o.id=r.order_id JOIN listings l ON l.id=o.listing_id JOIN events e ON e.id=l.event_id
    WHERE r.seller_id=$1 ORDER BY r.created_at DESC LIMIT $2`, [id, limit]);
}

export function favoriteEvents(userId: string) {
  return query<Event>(`SELECT ${eventFields} FROM events e JOIN favorites fv ON fv.event_id=e.id
    WHERE fv.user_id=$2 AND e.active ORDER BY e.starts_at`, [configuredMode(), userId]);
}

export async function isFavorite(userId: string, eventId: string) {
  return (await query("SELECT 1 FROM favorites WHERE user_id=$1 AND event_id=$2", [userId, eventId])).length > 0;
}

export async function sellerSummary(userId: string) {
  const [summary] = await query<{ sold: number; pending: number; paid: number; live: number }>(`SELECT
    (SELECT coalesce(sum(o.quantity),0)::int FROM orders o JOIN listings l ON l.id=o.listing_id
      WHERE l.seller_id=$1 AND o.status IN ('paid','delivered','confirmed')) AS sold,
    (SELECT coalesce(sum(o.subtotal-o.seller_fee),0)::int FROM orders o JOIN listings l ON l.id=o.listing_id
      WHERE l.seller_id=$1 AND o.status IN ('paid','delivered','confirmed') AND o.settled_at IS NULL) AS pending,
    (SELECT coalesce(sum(o.subtotal-o.seller_fee),0)::int FROM orders o JOIN listings l ON l.id=o.listing_id
      WHERE l.seller_id=$1 AND o.status='confirmed' AND o.settled_at IS NOT NULL) AS paid,
    (SELECT count(*)::int FROM listings WHERE seller_id=$1 AND status='active' AND available>0) AS live`, [userId]);
  return summary;
}

export type FeeSettings = { buyer_bps: number; seller_bps: number; max_markup_bps: number | null };

export async function fees() {
  const [settings] = await query<FeeSettings>("SELECT buyer_bps,seller_bps,max_markup_bps FROM fee_settings");
  return settings;
}

export type PaymentSettings = {
  bank_name: string | null; account_name: string | null; account_number: string | null;
  duitnow_id: string | null; qr_id: string | null; qr_remote: boolean | null; note: string | null;
};

export async function paymentSettings() {
  const [settings] = await query<PaymentSettings>("SELECT bank_name,account_name,account_number,duitnow_id,qr_id,note,(SELECT remote FROM media WHERE id=qr_id) AS qr_remote FROM payment_settings");
  return settings;
}

export const paymentConfigured = (settings: PaymentSettings) =>
  Boolean(settings.qr_id || settings.duitnow_id || (settings.bank_name && settings.account_number));

export const priceWithFee = (price: number, bps: number) => price + fee(price, bps);
