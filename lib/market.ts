import { query } from "./db";
import { fee, type Category, type EventImage } from "./format";

export type Event = {
  id: string; slug: string; title: string; category: Category; venue: string; city: string;
  starts_at: Date; description: string; image: EventImage; featured: boolean;
  transfer_policy_url: string | null; transfer_host: string | null;
  lowest: number | null; tickets: number;
};

const eventFields = `e.*, (
  SELECT min(l.price) FROM listings l JOIN users s ON s.id=l.seller_id
  WHERE l.event_id=e.id AND l.status='active' AND l.available>0 AND ($1 OR s.stripe_ready)
) AS lowest, (
  SELECT coalesce(sum(l.available),0)::int FROM listings l JOIN users s ON s.id=l.seller_id
  WHERE l.event_id=e.id AND l.status='active' AND ($1 OR s.stripe_ready)
) AS tickets`;

export function events(search = "", category = "") {
  return query<Event>(`SELECT ${eventFields} FROM events e
    WHERE e.active AND e.starts_at>now()
      AND ($2='' OR strpos(lower(e.title||' '||e.venue||' '||e.city),lower($2))>0)
      AND ($3='' OR e.category=$3)
    ORDER BY e.starts_at ASC, e.id LIMIT 200`, [process.env.PAYMENT_MODE !== "stripe", search, category]);
}

export async function event(slug: string) {
  const [item] = await query<Event>(`SELECT ${eventFields} FROM events e WHERE e.active AND e.slug=$2`, [process.env.PAYMENT_MODE !== "stripe", slug]);
  return item ?? null;
}

export function eventListings(id: string) {
  return query<{ id: string; section: string; price: number; available: number; seller: string; buyer_bps: number }>(`
    SELECT l.id,l.section,l.price,l.available,s.name AS seller,f.buyer_bps
    FROM listings l JOIN users s ON s.id=l.seller_id CROSS JOIN fee_settings f
    WHERE l.event_id=$1 AND l.status='active' AND l.available>0 AND ($2 OR s.stripe_ready)
    ORDER BY l.price,l.id`, [id, process.env.PAYMENT_MODE !== "stripe"]);
}

export async function fees() {
  const [settings] = await query<{ buyer_bps: number; seller_bps: number }>("SELECT buyer_bps,seller_bps FROM fee_settings");
  return settings;
}

export const priceWithFee = (price: number, bps: number) => price + fee(price, bps);
