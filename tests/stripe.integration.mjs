import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import pg from "pg";

const base = process.env.STRIPE_FIXTURE_BASE_URL ?? "http://localhost:3001";
const secret = process.env.STRIPE_WEBHOOK_SECRET;
const database = process.env.DATABASE_URL ?? "postgresql://ticketing:ticketing@127.0.0.1:5442/ticketing";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) ||
    !["localhost","127.0.0.1"].includes(new URL(database).hostname) ||
    !secret || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_fixture")) {
  throw new Error("Use a local fixture server and fixture Stripe keys for this test.");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function signedEvent(payload) {
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(base + "/api/stripe/webhook", {
    method: "POST", body: payload, headers: { "stripe-signature": signature, "content-type": "application/json" },
  });
}

test("Stripe signatures, gross payment amount and duplicate events govern paid orders", async () => {
  const client = new pg.Client({ connectionString: database });
  await client.connect();
  const orderId = randomUUID();
  const eventId = "evt_fixture_" + randomUUID();
  const intent = "pi_fixture_" + randomUUID();
  const charge = "ch_fixture_" + randomUUID();
  const payload = (amount) => JSON.stringify({
    id: eventId, type: "payment_intent.succeeded", data: { object: {
      id: intent, status: "succeeded", amount_received: amount, currency: "myr",
      metadata: { order_id: orderId }, latest_charge: charge,
    }},
  });
  try {
    const invalid = await fetch(base + "/api/stripe/webhook", {
      method: "POST", body: payload(10300), headers: { "stripe-signature": "invalid" },
    });
    assert.equal(invalid.status, 400);
    const fixture = await client.query(`
      INSERT INTO orders (id,listing_id,buyer_id,quantity,subtotal,buyer_bps,seller_bps,buyer_fee,seller_fee,payment_mode,expires_at)
      SELECT $1,l.id,u.id,1,10000,300,300,300,300,'stripe',now()+interval '45 minutes'
      FROM listings l JOIN events e ON e.id=l.event_id
      CROSS JOIN users u WHERE e.slug='after-hours' AND u.email='buyer@example.test' LIMIT 1`, [orderId]);
    assert.equal(fixture.rowCount, 1);
    assert.equal((await signedEvent(payload(10299))).status, 500);
    assert.equal((await client.query("SELECT status FROM orders WHERE id=$1", [orderId])).rows[0].status, "reserved");
    const results = await Promise.all([signedEvent(payload(10300)), signedEvent(payload(10300))]);
    assert.deepEqual(results.map((result) => result.status), [200, 200]);
    const { rows: [order] } = await client.query("SELECT status,payment_intent,charge_id FROM orders WHERE id=$1", [orderId]);
    assert.deepEqual(order, { status: "paid", payment_intent: intent, charge_id: charge });
    assert.equal((await client.query("SELECT id FROM stripe_events WHERE id=$1", [eventId])).rowCount, 1);
  } finally {
    await client.query("DELETE FROM orders WHERE id=$1", [orderId]);
    await client.query("DELETE FROM stripe_events WHERE id=$1", [eventId]);
    await client.end();
  }
});
