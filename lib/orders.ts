import { type PoolClient } from "pg";
import { query, tx } from "./db";
import { fee } from "./format";
import { paymentMode, sellerReady, type PaymentMode } from "./config";
import type { MessageKey } from "./messages";

/** A user-facing failure. The message is a dictionary key, translated when rendered. */
export class ActionError extends Error {
  constructor(public key: MessageKey) { super(key); }
}

export type Order = {
  id: string; buyer_id: string; listing_id: string; quantity: number; subtotal: number;
  buyer_fee: number; seller_fee: number; buyer_bps: number; seller_bps: number; payment_mode: PaymentMode;
  status: string; expires_at: Date; checkout_id: string | null; checkout_attempted: boolean;
  charge_id: string | null; payment_intent: string | null; net_payment: number | null;
  transfer_id: string | null; settled_at: Date | null; created_at: Date; paid_at: Date | null;
  refund_id: string | null; refund_reason: string | null; refund_attempt: number;
  transfer_ref: string | null; transfer_url: string | null; delivered_at: Date | null;
  title: string; slug: string; section: string; starts_at: Date; venue: string; image: string; poster_id: string | null; poster_remote: boolean | null;
  seller_id: string; seller: string; stripe_account: string | null; buyer_email: string; buyer_name: string;
  transfer_host: string | null; support_resolution: string | null; support_confirmed_at: Date | null;
  has_receipt: boolean; receipt_at: Date | null; payment_ref: string | null; reject_reason: string | null;
  refund_account: string | null; refund_ref: string | null; payout_ref: string | null;
  seller_phone: string | null; payout_bank: string | null; payout_name: string | null; payout_account: string | null;
};

// Explicit order columns keep the receipt image (bytea) out of ordinary reads.
const orderFields = `SELECT o.id,o.listing_id,o.buyer_id,o.quantity,o.subtotal,o.buyer_bps,o.seller_bps,o.buyer_fee,o.seller_fee,
  o.payment_mode,o.status,o.expires_at,o.checkout_id,o.checkout_attempted,o.payment_intent,o.charge_id,o.net_payment,
  o.paid_at,o.delivered_at,o.transfer_ref,o.transfer_url,o.refund_reason,o.refund_id,o.refund_attempt,o.transfer_id,
  o.settled_at,o.created_at,o.support_resolution,o.support_confirmed_at,o.receipt_at,o.payment_ref,o.reject_reason,
  o.refund_account,o.refund_ref,o.payout_ref,(o.receipt_file IS NOT NULL OR o.receipt_path IS NOT NULL) AS has_receipt,
  l.section,l.seller_id,s.name AS seller,s.stripe_account,s.phone AS seller_phone,
  s.payout_bank,s.payout_name,s.payout_account,
  e.title,e.slug,e.starts_at,e.venue,e.image,e.poster_id,(SELECT m.remote FROM media m WHERE m.id=e.poster_id) AS poster_remote,e.transfer_host,u.email AS buyer_email,u.name AS buyer_name
  FROM orders o JOIN listings l ON l.id=o.listing_id JOIN events e ON e.id=l.event_id
  JOIN users u ON u.id=o.buyer_id JOIN users s ON s.id=l.seller_id`;

export async function orderById(id: string, client?: PoolClient) {
  const sql = `${orderFields} WHERE o.id=$1${client ? " FOR UPDATE OF o" : ""}`;
  const [order] = client ? (await client.query<Order>(sql, [id])).rows : await query<Order>(sql, [id]);
  return order ?? null;
}

export function recentOrders(userId: string, role: "buyer" | "seller" | "admin", status?: string[]) {
  const condition = {
    buyer: "WHERE o.buyer_id=$1",
    seller: "WHERE l.seller_id=$1 AND o.status NOT IN ('reserved','verifying','expired','cancelled')",
    admin: status ? "WHERE o.status=ANY($1)" : "",
  }[role];
  const values = role === "admin" ? (status ? [status] : []) : [userId];
  return query<Order>(`${orderFields} ${condition} ORDER BY o.created_at DESC LIMIT 100`, values);
}

export function reserve(listing: string, buyer: string, quantity: number) {
  const mode = paymentMode();
  if (!mode) throw new ActionError("err.checkoutUnavailable");
  return tx(async (client) => {
    await releaseExpired(client);
    const { rows: [item] } = await client.query(`
      SELECT l.price,l.seller_id,f.buyer_bps,f.seller_bps
      FROM listings l JOIN events e ON e.id=l.event_id JOIN users s ON s.id=l.seller_id CROSS JOIN fee_settings f
      WHERE l.id=$1 AND l.status='active' AND e.active AND e.starts_at>now()+interval '45 minutes'
        AND ${sellerReady("$2")}
      FOR UPDATE OF l`, [listing, mode]);
    if (!item) throw new ActionError("err.listingUnavailable");
    if (item.seller_id === buyer) throw new ActionError("err.ownListing");
    const { rows: [existing] } = await client.query<{ id: string }>(`
      SELECT id FROM orders WHERE listing_id=$1 AND buyer_id=$2 AND status='reserved'
      AND (expires_at>now() AND (payment_mode<>'stripe' OR checkout_attempted OR expires_at>now()+interval '30 minutes')) ORDER BY created_at DESC LIMIT 1`, [listing, buyer]);
    if (existing) return existing.id;
    const update = await client.query("UPDATE listings SET available=available-$2 WHERE id=$1 AND available>=$2", [listing, quantity]);
    if (!update.rowCount) throw new ActionError("err.notEnough");
    const subtotal = item.price * quantity;
    const { rows: [order] } = await client.query<{ id: string }>(`
      INSERT INTO orders (listing_id,buyer_id,quantity,subtotal,buyer_bps,seller_bps,buyer_fee,seller_fee,payment_mode,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,date_trunc('second',now())+interval '45 minutes') RETURNING id`,
    [listing, buyer, quantity, subtotal, item.buyer_bps, item.seller_bps, fee(subtotal, item.buyer_bps), fee(subtotal, item.seller_bps), mode]);
    return order.id;
  });
}

/**
 * Returns expired manual/demo reservations to sale. Runs on reads and before reserving, so holds are
 * released on time without depending on a frequent cron (Stripe holds are reconciled by the job).
 */
export async function releaseExpired(client?: PoolClient) {
  const sql = `WITH expired AS (
      UPDATE orders SET status='expired'
      WHERE status='reserved' AND payment_mode IN ('manual','demo') AND expires_at<=now()
      RETURNING listing_id, quantity)
    UPDATE listings l SET available=l.available+e.qty
    FROM (SELECT listing_id, sum(quantity)::int AS qty FROM expired GROUP BY listing_id) e WHERE l.id=e.listing_id`;
  if (client) await client.query(sql);
  else await query(sql);
}

export async function release(client: PoolClient, order: Order, status: "expired" | "cancelled" = "expired") {
  const changed = await client.query("UPDATE orders SET status=$2 WHERE id=$1 AND status='reserved' RETURNING listing_id", [order.id, status]);
  if (changed.rowCount) await client.query("UPDATE listings SET available=available+$2 WHERE id=$1", [order.listing_id, order.quantity]);
}

export async function confirmDemo(id: string, buyer: string) {
  if (paymentMode() !== "demo") throw new ActionError("err.demoDisabled");
  await tx(async (client) => {
    const order = await orderById(id, client);
    if (!order || order.buyer_id !== buyer || order.status !== "reserved" || order.payment_mode !== "demo") {
      throw new ActionError("err.cannotPay");
    }
    if (order.expires_at.getTime() <= Date.now()) return release(client, order);
    await client.query("UPDATE orders SET status='paid',paid_at=now() WHERE id=$1", [id]);
  });
}

/** Manual mode: the buyer uploads a transfer receipt; inventory stays held until an operator verifies it. */
export function submitReceipt(id: string, buyer: string, receipt: { file: Buffer | null; path: string | null }) {
  return tx(async (client) => {
    const order = await orderById(id, client);
    if (!order || order.buyer_id !== buyer || order.payment_mode !== "manual" || order.status !== "reserved") {
      throw new ActionError("err.cannotUpload");
    }
    if (order.expires_at.getTime() <= Date.now()) {
      await release(client, order);
      return false;
    }
    await client.query("UPDATE orders SET status='verifying',receipt_file=$2,receipt_path=$3,receipt_at=now(),reject_reason=NULL WHERE id=$1",
      [id, receipt.file, receipt.path]);
    return true;
  });
}

export function verifyManualPayment(id: string, approve: boolean, note: string) {
  return tx(async (client) => {
    const order = await orderById(id, client);
    if (!order || order.payment_mode !== "manual" || order.status !== "verifying") throw new ActionError("err.notVerifying");
    if (approve) {
      await client.query("UPDATE orders SET status='paid',paid_at=now(),payment_ref=$2 WHERE id=$1", [id, note || null]);
    } else {
      await client.query("UPDATE orders SET status='cancelled',reject_reason=$2 WHERE id=$1", [id, note]);
      await client.query("UPDATE listings SET available=available+$2 WHERE id=$1", [order.listing_id, order.quantity]);
    }
  });
}
