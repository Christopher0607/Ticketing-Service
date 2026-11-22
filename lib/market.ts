import { query } from "./db";
import { configuredMode, sellerReady } from "./config";
import { fee, type Category, type EventImage } from "./format";

export type Event = {
  id: string; slug: string; title: string; category: Category; venue: string; city: string;
  starts_at: Date; description: string; image: EventImage; poster_id: string | null; featured: boolean;
  transfer_policy_url: string | null; transfer_host: string | null;
  lowest: number | null; tickets: number;
};

const eventFields = `e.*, (
  SELECT min(l.price) FROM listings l JOIN users s ON s.id=l.seller_id
  WHERE l.event_id=e.id AND l.status='active' AND l.available>0 AND ${sellerReady("$1")}
) AS lowest, (
  SELECT coalesce(sum(l.available),0)::int FROM listings l JOIN users s ON s.id=l.seller_id
  WHERE l.event_id=e.id AND l.status='active' AND ${sellerReady("$1")}
) AS tickets`;

export function events(search = "", category = "") {
  return query<Event>(`SELECT ${eventFields} FROM events e
    WHERE e.active AND e.starts_at>now()
      AND ($2='' OR strpos(lower(e.title||' '||e.venue||' '||e.city),lower($2))>0)
      AND ($3='' OR e.category=$3)
    ORDER BY e.starts_at ASC, e.id LIMIT 200`, [configuredMode(), search, category]);
}

export async function event(slug: string) {
  const [item] = await query<Event>(`SELECT ${eventFields} FROM events e WHERE e.active AND e.slug=$2`, [configuredMode(), slug]);
  return item ?? null;
}

export type PublicListing = {
  id: string; section: string; price: number; face_value: number | null; available: number; seller: string; buyer_bps: number;
};

export function eventListings(id: string) {
  return query<PublicListing>(`
    SELECT l.id,l.section,l.price,l.face_value,l.available,s.name AS seller,f.buyer_bps
    FROM listings l JOIN users s ON s.id=l.seller_id CROSS JOIN fee_settings f
    WHERE l.event_id=$1 AND l.status='active' AND l.available>0 AND ${sellerReady("$2")}
    ORDER BY l.price,l.id`, [id, configuredMode()]);
}

export type FeeSettings = { buyer_bps: number; seller_bps: number; max_markup_bps: number | null };

export async function fees() {
  const [settings] = await query<FeeSettings>("SELECT buyer_bps,seller_bps,max_markup_bps FROM fee_settings");
  return settings;
}

export type PaymentSettings = {
  bank_name: string | null; account_name: string | null; account_number: string | null;
  duitnow_id: string | null; qr_id: string | null; note: string | null;
};

export async function paymentSettings() {
  const [settings] = await query<PaymentSettings>("SELECT bank_name,account_name,account_number,duitnow_id,qr_id,note FROM payment_settings");
  return settings;
}

export const paymentConfigured = (settings: PaymentSettings) =>
  Boolean(settings.qr_id || settings.duitnow_id || (settings.bank_name && settings.account_number));

export const priceWithFee = (price: number, bps: number) => price + fee(price, bps);
