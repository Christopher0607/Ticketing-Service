import type Stripe from "stripe";
import { paymentMode } from "@/lib/config";
import { query } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (paymentMode() !== "stripe" || !secret) return new Response("Stripe Connect disabled", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (event.type === "account.updated" && event.account && event.account === event.data.object.id) {
    const account = await stripe.accounts.retrieve(event.account);
    const ready = !("deleted" in account) && account.payouts_enabled && account.capabilities?.transfers === "active";
    await query("UPDATE users SET stripe_ready=$2 WHERE stripe_account=$1", [account.id, ready]);
  }
  return Response.json({ received: true });
}
