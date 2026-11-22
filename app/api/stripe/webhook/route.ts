import { paymentMode } from "@/lib/config";
import { query } from "@/lib/db";
import { uuid } from "@/lib/format";
import { notify } from "@/lib/notify";
import { handleStripeEvent, stripeClient } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(request: Request) {
  if (paymentMode() !== "stripe") return new Response("Stripe disabled", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const fresh = await handleStripeEvent(event);
    if (fresh && event.type === "payment_intent.succeeded" && uuid.test(event.data.object.metadata.order_id ?? "")) {
      const [order] = await query<{ status: string }>("SELECT status FROM orders WHERE id=$1", [event.data.object.metadata.order_id]);
      if (order?.status === "paid") await notify.paid(event.data.object.metadata.order_id);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe event failed", event.id, error);
    return new Response("Retry later", { status: 500 });
  }
}
