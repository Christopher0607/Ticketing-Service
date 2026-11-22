import Stripe from "stripe";
import { type PoolClient } from "pg";
import { appUrl, paymentMode } from "./config";
import { query, tx } from "./db";
import { ActionError, orderById, release, type Order } from "./orders";
import { uuid } from "./format";

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 });
}

function createSession(order: Order) {
  const origin = appUrl();
  return stripeClient().checkout.sessions.create({
    mode: "payment",
    payment_method_types: process.env.STRIPE_ENABLE_FPX === "true" && order.subtotal + order.buyer_fee <= 3000000
      ? ["card", "fpx"] : ["card"],
    customer_email: order.buyer_email,
    expires_at: Math.floor(order.expires_at.getTime() / 1000),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "myr", unit_amount: order.subtotal + order.buyer_fee,
        product_data: { name: `${order.title} · ${order.quantity} ticket(s)`.slice(0, 120) },
      },
    }],
    metadata: { order_id: order.id },
    payment_intent_data: { metadata: { order_id: order.id }, transfer_group: order.id },
    success_url: `${origin}/orders/${order.id}?payment=returned`,
    cancel_url: `${origin}/orders/${order.id}`,
  }, { idempotencyKey: `checkout-${order.id}` });
}

export async function checkout(id: string, buyerId: string) {
  if (paymentMode() !== "stripe") throw new ActionError("err.stripeUnavailable");
  const [claimed] = await query(`UPDATE orders SET checkout_attempted=true
    WHERE id=$1 AND buyer_id=$2 AND payment_mode='stripe' AND status='reserved' AND
      (checkout_id IS NOT NULL OR expires_at>now()+interval '30 minutes') RETURNING id`, [id, buyerId]);
  if (!claimed) throw new ActionError("err.checkoutExpired");
  return tx(async (client) => {
    const order = await orderById(id, client);
    if (!order || order.status !== "reserved" || order.buyer_id !== buyerId) throw new ActionError("err.checkoutExpired");
    const session = order.checkout_id
      ? await stripeClient().checkout.sessions.retrieve(order.checkout_id)
      : await createSession(order);
    if (!order.checkout_id) await client.query("UPDATE orders SET checkout_id=$2 WHERE id=$1", [id, session.id]);
    if (session.status === "expired") await release(client, order);
    if (session.payment_status === "paid" && typeof session.payment_intent === "string") {
      await recordStripePayment(client, order, await stripeClient().paymentIntents.retrieve(session.payment_intent));
    }
    return session.status === "open" ? session.url : null;
  });
}

export async function cancelReservation(id: string, buyer: string) {
  return tx(async (client) => {
    const order = await orderById(id, client);
    if (!order || order.buyer_id !== buyer || order.status !== "reserved") throw new ActionError("err.cannotCancel");
    if (order.payment_mode === "stripe" && order.checkout_attempted) {
      if (!order.checkout_id) throw new ActionError("err.verifyingStripe");
      const stripe = stripeClient();
      const session = await stripe.checkout.sessions.retrieve(order.checkout_id);
      if (session.status === "complete") {
        if (session.payment_status === "paid" && typeof session.payment_intent === "string") {
          await recordStripePayment(client, order, await stripe.paymentIntents.retrieve(session.payment_intent));
        }
        return false;
      }
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id, {}, { idempotencyKey: `expire-${id}` });
      if (session.status !== "open" && session.status !== "expired") return false;
    }
    await release(client, order, "cancelled");
    return true;
  });
}

async function recordStripePayment(client: PoolClient, order: Order, intent: Stripe.PaymentIntent) {
  if (order.status !== "reserved" || order.payment_mode !== "stripe") return;
  if (intent.status !== "succeeded" || intent.currency !== "myr" || intent.amount_received !== order.subtotal + order.buyer_fee) {
    throw new Error("Payment does not match reserved order");
  }
  const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
  if (!chargeId) throw new Error("Successful payment has no charge");
  await client.query(`UPDATE orders SET status='paid',paid_at=now(),payment_intent=$2,charge_id=$3 WHERE id=$1`,
    [order.id, intent.id, chargeId]);
}

/** Applies a Stripe event once. Returns false when the event was already processed. */
export async function handleStripeEvent(event: Stripe.Event) {
  return tx(async (client) => {
    const seen = await client.query("INSERT INTO stripe_events (id,type) VALUES ($1,$2) ON CONFLICT DO NOTHING", [event.id, event.type]);
    if (!seen.rowCount) return false;
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const id = intent.metadata.order_id;
      if (id && uuid.test(id)) {
        const order = await orderById(id, client);
        if (order) await recordStripePayment(client, order, intent);
      }
    }
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const id = session.metadata?.order_id;
      if (id && uuid.test(id)) {
        const order = await orderById(id, client);
        if (order?.payment_mode === "stripe" && (!order.checkout_id || order.checkout_id === session.id)) await release(client, order);
      }
    }
    if (event.type === "refund.updated" || event.type === "refund.failed" || event.type === "refund.created") {
      const refund = await stripeClient().refunds.retrieve(event.data.object.id);
      await recordRefund(client, refund);
    }
    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
      const dispute = await stripeClient().disputes.retrieve(event.data.object.id);
      const charge = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
      const { rowCount } = await client.query("SELECT 1 FROM orders WHERE charge_id=$1", [charge]);
      if (!rowCount && dispute.payment_intent) {
        const intent = typeof dispute.payment_intent === "string"
          ? await stripeClient().paymentIntents.retrieve(dispute.payment_intent) : dispute.payment_intent;
        const orderId = intent.metadata.order_id;
        if (orderId && uuid.test(orderId)) {
          const order = await orderById(orderId, client);
          if (order) await recordStripePayment(client, order, intent);
        }
      }
      if (dispute.status === "won" || dispute.status === "warning_closed") {
        await client.query(`UPDATE orders SET status=CASE
          WHEN refund_id IS NOT NULL THEN 'refund_pending' ELSE coalesce(pre_dispute_status,'paid') END,pre_dispute_status=NULL
          WHERE charge_id=$1 AND status='disputed'`, [charge]);
      } else {
        await client.query(`UPDATE orders SET pre_dispute_status=status,status='disputed' WHERE charge_id=$1 AND status NOT IN ('disputed','refunded')`, [charge]);
      }
    }
    return true;
  });
}

async function recordRefund(client: PoolClient, refund: Stripe.Refund) {
  const id = refund.metadata?.order_id;
  if (!id || !uuid.test(id)) return;
  if (refund.status === "succeeded") {
    await client.query("UPDATE orders SET status='refunded',refund_id=$2 WHERE id=$1 AND refund_id=$2 AND status IN ('refund_pending','disputed')", [id, refund.id]);
  }
  if (refund.status === "failed" || refund.status === "canceled") {
    await client.query(`UPDATE orders SET status='refund_requested',refund_id=NULL,refund_attempt=refund_attempt+1
      WHERE id=$1 AND refund_id=$2 AND status='refund_pending'`, [id, refund.id]);
  }
}

export async function approveRefund(id: string, reference = "") {
  return tx(async (client) => {
    const order = await orderById(id, client);
    if (!order || order.status !== "refund_requested" || order.settled_at) throw new ActionError("err.refundManual");
    if (order.payment_mode === "manual") {
      // The operator sends the refund by bank transfer / DuitNow and records its reference.
      if (reference.length < 2) throw new ActionError("err.refundRef");
      await client.query("UPDATE orders SET status='refunded',refund_ref=$2 WHERE id=$1", [id, reference]);
      return;
    }
    if (order.payment_mode === "demo") {
      if (paymentMode() !== "demo") throw new ActionError("err.demoDisabled");
      await client.query("UPDATE orders SET status='refunded' WHERE id=$1", [id]);
      return;
    }
    if (!order.payment_intent) throw new ActionError("err.paymentMissing");
    const refund = await stripeClient().refunds.create({
      payment_intent: order.payment_intent, amount: order.subtotal + order.buyer_fee, metadata: { order_id: id },
    }, { idempotencyKey: `refund-${id}-${order.refund_attempt}` });
    await client.query("UPDATE orders SET status='refund_pending',refund_id=$2 WHERE id=$1", [id, refund.id]);
    await recordRefund(client, refund);
  });
}

export async function settle(id: string, reference = "") {
  return tx(async (client) => {
    const order = await orderById(id, client);
    if (!order || order.status !== "confirmed" || order.settled_at || order.starts_at.getTime() + 86400000 > Date.now()) {
      throw new ActionError("err.settleWindow");
    }
    if (order.payment_mode === "manual") {
      // The operator pays the seller's payout account and records the transfer reference.
      if (!order.payout_account) throw new ActionError("err.payoutMissing");
      if (reference.length < 2) throw new ActionError("err.payoutRef");
      await client.query("UPDATE orders SET settled_at=now(),payout_ref=$2 WHERE id=$1", [id, reference]);
      return;
    }
    if (order.payment_mode === "demo") {
      if (paymentMode() !== "demo") throw new ActionError("err.demoDisabled");
      await client.query("UPDATE orders SET settled_at=now() WHERE id=$1", [id]);
      return;
    }
    if (!order.charge_id || !order.stripe_account) throw new ActionError("err.stripeDetails");
    const stripe = stripeClient();
    const charge = await stripe.charges.retrieve(order.charge_id, { expand: ["balance_transaction"] });
    if (charge.disputed || charge.amount_refunded > 0) throw new ActionError("err.manualReview");
    const balance = charge.balance_transaction;
    if (!balance || typeof balance === "string" || balance.currency !== "myr") throw new ActionError("err.myrBalance");
    const transfer = await stripe.transfers.create({
      amount: order.subtotal - order.seller_fee, currency: "myr", destination: order.stripe_account,
      source_transaction: order.charge_id, transfer_group: order.id, metadata: { order_id: id },
    }, { idempotencyKey: `settlement-${id}` });
    await client.query("UPDATE orders SET settled_at=now(),transfer_id=$2,net_payment=$3 WHERE id=$1", [id, transfer.id, balance.net]);
  });
}

// Search the full bounded creation window before releasing a reservation with an uncertain API result.
async function lookupLostSession(stripe: Stripe, order: Order) {
  const earliest = Math.floor(order.created_at.getTime() / 1000) - 30;
  const latest = Math.floor(order.expires_at.getTime() / 1000) - 1800 + 30;
  for await (const session of stripe.checkout.sessions.list({ created: { gte: earliest, lte: latest }, limit: 100 })) {
    if (session.metadata?.order_id === order.id) return session;
  }
  return null;
}

export async function reconcile() {
  await query("DELETE FROM sessions WHERE expires_at<now()");
  await query("DELETE FROM email_tokens WHERE expires_at<now()");
  await query("DELETE FROM auth_limits WHERE window_start<now()-interval '1 day'");
  const items = await query<{ id: string }>(`SELECT id FROM orders
    WHERE (status='reserved' AND (
      (payment_mode IN ('demo','manual') AND expires_at<=now()) OR
      (payment_mode='stripe' AND NOT checkout_attempted AND expires_at<=now()+interval '30 minutes') OR
      (payment_mode='stripe' AND checkout_attempted AND expires_at<=now()-interval '2 minutes')
    )) OR (status='refund_pending' AND refund_id IS NOT NULL)
    ORDER BY reconciled_at NULLS FIRST, created_at LIMIT 50`);
  let failures = 0;
  for (const { id } of items) {
    try {
      await tx(async (client) => {
        const order = await orderById(id, client);
        if (!order) return;
        if (order.status === "refund_pending" && order.refund_id) {
          await recordRefund(client, await stripeClient().refunds.retrieve(order.refund_id));
          return;
        }
        if (order.status !== "reserved") return;
        const expiry = order.expires_at.getTime();
        if (order.payment_mode === "stripe" && !order.checkout_attempted && expiry - 1800000 <= Date.now()) {
          await release(client, order);
          return;
        }
        if (expiry > Date.now()) return;
        if (order.payment_mode !== "stripe") {
          await release(client, order);
          return;
        }
        const stripe = stripeClient();
        const session = order.checkout_id
          ? await stripe.checkout.sessions.retrieve(order.checkout_id)
          : await lookupLostSession(stripe, order);
        if (!session) return release(client, order);
        if (!order.checkout_id) await client.query("UPDATE orders SET checkout_id=$2 WHERE id=$1", [id, session.id]);
        if (session.status === "expired") await release(client, order);
        if (session.payment_status === "paid" && typeof session.payment_intent === "string") {
          await recordStripePayment(client, order, await stripe.paymentIntents.retrieve(session.payment_intent));
        }
      });
    } catch (error) {
      failures++;
      console.error("Reconciliation failed for order", id, error instanceof Error ? error.message : "");
    } finally {
      await query("UPDATE orders SET reconciled_at=now() WHERE id=$1", [id]);
    }
  }
  return { checked: items.length, failures };
}
