import { type PoolClient } from "pg";
import { query, tx } from "./db";
import { fee } from "./format";
import { paymentMode, type PaymentMode } from "./config";

export class ActionError extends Error {}

export type Order = {
  id: string; buyer_id: string; listing_id: string; quantity: number; subtotal: number;
  buyer_fee: number; seller_fee: number; buyer_bps: number; seller_bps: number; payment_mode: PaymentMode;
  status: string; expires_at: Date; checkout_id: string | null; checkout_attempted: boolean;
  charge_id: string | null; payment_intent: string | null; net_payment: number | null;
  transfer_id: string | null; settled_at: Date | null; created_at: Date; paid_at: Date | null;
  refund_id: string | null; refund_reason: string | null; refund_attempt: number;
  transfer_ref: string | null; transfer_url: string | null; delivered_at: Date | null;
  title: string; slug: string; section: string; starts_at: Date; venue: string; image: string;
  seller_id: string; seller: string; stripe_account: string | null; buyer_email: string;
  transfer_host: string | null; support_resolution: string | null; support_confirmed_at: Date | null;
};
const orderFields = `SELECT o.*,l.section,l.seller_id,s.name AS seller,s.stripe_account,
  e.title,e.slug,e.starts_at,e.venue,e.image,e.transfer_host,u.email AS buyer_email
  FROM orders o JOIN listings l ON l.id=o.listing_id JOIN events e ON e.id=l.event_id
  JOIN users u ON u.id=o.buyer_id JOIN users s ON s.id=l.seller_id`;

export async function orderById(id: string, client?: PoolClient) {
  const sql = `${orderFields} WHERE o.id=$1${client ? " FOR UPDATE OF o" : ""}`;
  const [order] = client ? (await client.query<Order>(sql, [id])).rows : await query<Order>(sql, [id]);
  return order ?? null;
}

export function recentOrders(userId: string, role: "buyer" | "seller" | "admin") {
  const condition = { buyer: "WHERE o.buyer_id=$1", seller: "WHERE l.seller_id=$1 AND o.status NOT IN ('reserved','expired','cancelled')", admin: "" }[role];
  return query<Order>(`${orderFields} ${condition} ORDER BY o.created_at DESC LIMIT 100`, role === "admin" ? [] : [userId]);
}

export function reserve(listing: string, buyer: string, quantity: number) {
  const mode = paymentMode();
  if (!mode) throw new ActionError("Checkout is temporarily unavailable.");
  return tx(async (client) => {
    const { rows: [item] } = await client.query(`
      SELECT l.price,l.seller_id,f.buyer_bps,f.seller_bps
      FROM listings l JOIN events e ON e.id=l.event_id JOIN users s ON s.id=l.seller_id CROSS JOIN fee_settings f
      WHERE l.id=$1 AND l.status='active' AND e.active AND e.starts_at>now()+interval '45 minutes'
        AND ($2='demo' OR s.stripe_ready)
      FOR UPDATE OF l`, [listing, mode]);
    if (!item) throw new ActionError("This listing is currently unavailable.");
    if (item.seller_id === buyer) throw new ActionError("You cannot buy from your own listing.");
    const { rows: [existing] } = await client.query<{ id: string }>(`
      SELECT id FROM orders WHERE listing_id=$1 AND buyer_id=$2 AND status='reserved'
      AND (expires_at>now() AND (payment_mode='demo' OR checkout_attempted OR expires_at>now()+interval '30 minutes')) ORDER BY created_at DESC LIMIT 1`, [listing, buyer]);
    if (existing) return existing.id;
    const update = await client.query("UPDATE listings SET available=available-$2 WHERE id=$1 AND available>=$2", [listing, quantity]);
    if (!update.rowCount) throw new ActionError("There aren’t enough tickets. Try a smaller quantity.");
    const subtotal = item.price * quantity;
    const { rows: [order] } = await client.query<{ id: string }>(`
      INSERT INTO orders (listing_id,buyer_id,quantity,subtotal,buyer_bps,seller_bps,buyer_fee,seller_fee,payment_mode,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,date_trunc('second',now())+interval '45 minutes') RETURNING id`,
    [listing, buyer, quantity, subtotal, item.buyer_bps, item.seller_bps, fee(subtotal, item.buyer_bps), fee(subtotal, item.seller_bps), mode]);
    return order.id;
  });
}

export async function release(client: PoolClient, order: Order, status: "expired" | "cancelled" = "expired") {
  const changed = await client.query("UPDATE orders SET status=$2 WHERE id=$1 AND status='reserved' RETURNING listing_id", [order.id, status]);
  if (changed.rowCount) await client.query("UPDATE listings SET available=available+$2 WHERE id=$1", [order.listing_id, order.quantity]);
}

export async function confirmDemo(id: string, buyer: string) {
  if (paymentMode() !== "demo") throw new ActionError("Demo payments are disabled.");
  await tx(async (client) => {
    const order = await orderById(id, client);
    if (!order || order.buyer_id !== buyer || order.status !== "reserved" || order.payment_mode !== "demo") {
      throw new ActionError("This order cannot be paid.");
    }
    if (order.expires_at.getTime() <= Date.now()) return release(client, order);
    await client.query("UPDATE orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
  });
}
