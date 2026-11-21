"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authAllowed, clearSession, createSession, passwordHash, passwordMatches, requireUser } from "@/lib/auth";
import { appUrl, paymentMode } from "@/lib/config";
import { query } from "@/lib/db";
import { consumeAccountLink, mailConfigured, sendAccountLink } from "@/lib/identity";
import { categories, uuid } from "@/lib/format";
import { ActionError, confirmDemo, orderById, reserve } from "@/lib/orders";
import { approveRefund, cancelReservation, checkout, settle, stripeClient } from "@/lib/stripe";

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const id = (form: FormData, key = "id") => {
  const value = field(form, key);
  if (!uuid.test(value)) throw new ActionError("Invalid record.");
  return value;
};
const text = (form: FormData, key: string, min: number, max: number) => {
  const value = field(form, key);
  if (value.length < min || value.length > max) throw new ActionError(`Enter ${min}–${max} characters for ${key}.`);
  return value;
};
function scaled(form: FormData, key: string, min: number, max: number, decimals = false) {
  const value = field(form, key);
  if (!(decimals ? /^\d+(\.\d{1,2})?$/ : /^\d+$/).test(value)) throw new ActionError(`Enter a valid ${key}.`);
  const number = Math.round(Number(value) * (decimals ? 100 : 1));
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new ActionError(`Enter a valid ${key}.`);
  return number;
}
function safeNext(value: string) {
  return /^\/(account|sell|admin|events\/[a-z0-9-]+|orders\/[a-f0-9-]+)$/.test(value) ? value : "/account";
}
function httpsUrl(value: string) {
  if (value.length > 1500) throw new ActionError("The link is too long.");
  let url: URL;
  try { url = new URL(value); } catch { throw new ActionError("Enter a valid HTTPS link."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new ActionError("Enter a valid HTTPS link.");
  return url;
}
function message(path: string, key: "error" | "success", value: string): never {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, value);
  redirect(url.pathname + url.search);
}
async function attempt<T>(path: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ActionError) message(path, "error", error.message);
    console.error("Marketplace action failed", error instanceof Error ? error.message : error);
    message(path, "error", "We couldn’t complete that action. Please try again.");
  }
}
const emailSchema = z.email().max(254);
const dummyHash = passwordHash(randomBytes(32).toString("hex"));

export async function signIn(form: FormData) {
  const next = safeNext(field(form, "next"));
  const path = `/account?next=${encodeURIComponent(next)}`;
  await attempt(path, async () => {
    const email = field(form, "email").toLowerCase();
    const password = String(form.get("password") ?? "");
    if (!emailSchema.safeParse(email).success || password.length > 128) throw new ActionError("Check your email and password.");
    if (!(await authAllowed(email))) throw new ActionError("Too many attempts. Try again in 15 minutes.");
    const [user] = await query<{ id: string; password_hash: string }>("SELECT id,password_hash FROM users WHERE email=$1", [email]);
    if (!passwordMatches(password, user?.password_hash ?? dummyHash) || !user) throw new ActionError("Check your email and password.");
    await createSession(user.id);
  });
  redirect(next);
}

export async function signUp(form: FormData) {
  const next = safeNext(field(form, "next"));
  const path = `/account?mode=register&next=${encodeURIComponent(next)}`;
  await attempt(path, async () => {
    const email = field(form, "email").toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = text(form, "name", 2, 80);
    if (!emailSchema.safeParse(email).success) throw new ActionError("Enter a valid email.");
    if (password.length < 12 || password.length > 128) throw new ActionError("Use a password with 12–128 characters.");
    if (!(await authAllowed(email))) throw new ActionError("Too many attempts. Try again in 15 minutes.");
    const demo = paymentMode() === "demo";
    if (!demo && !mailConfigured()) throw new ActionError("Registration is temporarily unavailable.");
    const [user] = await query<{ id: string }>(`INSERT INTO users (name,email,password_hash,email_verified) VALUES ($1,$2,$3,$4)
      ON CONFLICT (email) DO NOTHING RETURNING id`, [name, email, passwordHash(password), demo]);
    if (!user) throw new ActionError("Unable to create this account. Try signing in.");
    await createSession(user.id);
    if (!demo) {
      try { await sendAccountLink({ id: user.id, email }, "verify"); }
      catch (error) { console.error("Verification email could not be sent", error instanceof Error ? error.message : error); }
    }
  });
  redirect(paymentMode() === "demo" ? next : "/account");
}

export async function signOut() {
  await clearSession();
  redirect("/");
}

export async function requestSelling() {
  const user = await requireUser();
  await attempt("/account", async () => {
    if (!user.email_verified) throw new ActionError("Verify your email before applying.");
    await query("UPDATE users SET seller_requested=true WHERE id=$1 AND role='buyer'", [user.id]);
  });
  message("/account", "success", "Your seller application was sent.");
}

export async function approveSeller(form: FormData) {
  await requireUser("/admin", "admin");
  await attempt("/admin", async () => {
    const [updated] = await query("UPDATE users SET role='seller',seller_requested=false WHERE id=$1 AND role='buyer' AND seller_requested RETURNING id", [id(form)]);
    if (!updated) throw new ActionError("This application is already closed.");
  });
  message("/admin", "success", "Seller approved.");
}

export async function startCheckout(form: FormData) {
  const path = safeNext(`/events/${field(form, "slug")}`);
  const user = await requireUser(path);
  if (!user.email_verified) message("/account", "error", "Verify your email before reserving tickets.");
  const orderId = await attempt(path, () => reserve(id(form), user.id, scaled(form, "quantity", 1, 10)));
  redirect(`/orders/${orderId}`);
}

export async function payOrder(form: FormData) {
  const orderId = id(form);
  const path = `/orders/${orderId}`;
  const user = await requireUser(path);
  const url = await attempt(path, async () => {
    const order = await orderById(orderId);
    if (!order || order.buyer_id !== user.id) throw new ActionError("Order unavailable.");
    if (order.payment_mode === "demo") {
      await confirmDemo(orderId, user.id);
      return null;
    }
    return checkout(orderId, user.id);
  });
  redirect(url ?? path);
}

export async function deliverOrder(form: FormData) {
  const orderId = id(form);
  const path = `/orders/${orderId}`;
  const user = await requireUser(path, "seller");
  await attempt(path, async () => {
    const order = await orderById(orderId);
    if (!order || order.seller_id !== user.id) throw new ActionError("Order unavailable.");
    const reference = text(form, "reference", 2, 180);
    const link = field(form, "link") ? httpsUrl(field(form, "link")) : null;
    if (link && link.hostname !== order.transfer_host) throw new ActionError("Use the official transfer domain for this event.");
    const [updated] = await query(`UPDATE orders SET status='delivered',transfer_ref=$2,transfer_url=$3,delivered_at=now()
      WHERE id=$1 AND status='paid' RETURNING id`, [orderId, reference, link?.href ?? null]);
    if (!updated) throw new ActionError("This order cannot currently be transferred.");
  });
  message(path, "success", "Transfer recorded.");
}

export async function confirmReceipt(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  const user = await requireUser(path);
  await attempt(path, async () => {
    const [updated] = await query("UPDATE orders SET status='confirmed' WHERE id=$1 AND buyer_id=$2 AND status='delivered' RETURNING id", [order, user.id]);
    if (!updated) throw new ActionError("This order cannot be confirmed yet.");
  });
  message(path, "success", "Ticket receipt confirmed.");
}

export async function requestRefund(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  const user = await requireUser(path);
  await attempt(path, async () => {
    const [updated] = await query(`UPDATE orders SET pre_refund_status=status,status='refund_requested',refund_reason=$3
      WHERE id=$1 AND buyer_id=$2 AND status IN ('paid','delivered','confirmed') AND settled_at IS NULL RETURNING id`,
    [order, user.id, text(form, "reason", 5, 500)]);
    if (!updated) throw new ActionError("This order requires manual support.");
  });
  message(path, "success", "Refund request sent for review.");
}

export async function reviewRefund(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  await requireUser(path, "admin");
  await attempt(path, async () => {
    if (field(form, "decision") === "approve") await approveRefund(order);
    else {
      const [updated] = await query(`UPDATE orders SET status=pre_refund_status,pre_refund_status=NULL
        WHERE id=$1 AND status='refund_requested' AND pre_refund_status IS NOT NULL RETURNING id`, [order]);
      if (!updated) throw new ActionError("The request has already changed.");
    }
  });
  message(path, "success", "Refund review saved.");
}

export async function settleOrder(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  await requireUser(path, "admin");
  await attempt(path, () => settle(order));
  message(path, "success", "Seller settlement recorded.");
}

export async function createListing(form: FormData) {
  const user = await requireUser("/sell", "seller");
  await attempt("/sell", async () => {
    const event = id(form, "event");
    const quantity = scaled(form, "quantity", 1, 100);
    const attachment = form.get("attachment");
    let proofFile: Buffer | null = null;
    let proofType: string | null = null;
    if (attachment instanceof File && attachment.size > 0) {
      if (attachment.size > 2097152) throw new ActionError("Keep the proof file under 2 MB.");
      proofFile = Buffer.from(await attachment.arrayBuffer());
      if (proofFile.subarray(0, 5).toString() === "%PDF-") proofType = "application/pdf";
      else if (proofFile.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") proofType = "image/png";
      else if (proofFile.subarray(0, 3).toString("hex") === "ffd8ff") proofType = "image/jpeg";
      else throw new ActionError("Use a PDF, PNG or JPG file for your proof.");
    }
    const [listing] = await query(`INSERT INTO listings (event_id,seller_id,section,price,quantity,available,proof,proof_file,proof_type)
      SELECT id,$2,$3,$4,$5,$5,$6,$7,$8 FROM events WHERE id=$1 AND active AND starts_at>now()+interval '45 minutes' RETURNING id`,
    [event, user.id, text(form, "section", 2, 80), scaled(form, "price", 200, 2500000, true), quantity,
      text(form, "proof", 5, 1000), proofFile, proofType]);
    if (!listing) throw new ActionError("This event is unavailable.");
  });
  message("/sell", "success", "Listing sent for review.");
}

export async function reviewListing(form: FormData) {
  await requireUser("/admin", "admin");
  await attempt("/admin", async () => {
    const status = field(form, "decision");
    if (!["active","rejected","paused"].includes(status)) throw new ActionError("Invalid decision.");
    const [updated] = await query(`UPDATE listings SET status=$2,paused_by_admin=($2='paused') WHERE id=$1 AND
      (($2='rejected' AND status='pending') OR ($2='paused' AND status='active') OR ($2='active' AND status IN ('pending','paused')))
      RETURNING id`, [id(form), status]);
    if (!updated) throw new ActionError("The listing has already changed.");
  });
  message("/admin", "success", "Listing updated.");
}

export async function pauseListing(form: FormData) {
  const user = await requireUser("/sell", "seller");
  await attempt("/sell", async () => {
    const status = field(form, "decision");
    if (!["active","paused"].includes(status)) throw new ActionError("Invalid decision.");
    const [updated] = await query(`UPDATE listings SET status=$3 WHERE id=$1 AND seller_id=$2 AND
      (($3='paused' AND status='active') OR ($3='active' AND status='paused' AND paused_by_admin=false)) RETURNING id`,
    [id(form), user.id, status]);
    if (!updated) throw new ActionError("This listing needs an administrator’s review.");
  });
  message("/sell", "success", "Listing updated.");
}

export async function updateFees(form: FormData) {
  await requireUser("/admin", "admin");
  await attempt("/admin", async () => {
    await query("UPDATE fee_settings SET buyer_bps=$1,seller_bps=$2",
      [scaled(form, "buyer fee", 0, 3000, true), scaled(form, "seller fee", 0, 3000, true)]);
  });
  message("/admin", "success", "Rates updated for new orders.");
}

export async function createEvent(form: FormData) {
  await requireUser("/admin", "admin");
  await attempt("/admin", async () => {
    const title = text(form, "title", 3, 100);
    const category = field(form, "category");
    const start = field(form, "start");
    const date = new Date(start + ":00+08:00");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) || !(date.getTime() > Date.now() + 2700000)) throw new ActionError("Enter an upcoming event date.");
    if (!categories.some((value) => value === category)) throw new ActionError("Choose a category.");
    const policy = httpsUrl(field(form, "policy"));
    const transfer = httpsUrl(field(form, "transfer site"));
    const slug = (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65) || "event") + "-" + randomBytes(4).toString("hex");
    const image = { Concerts: "concert", Festivals: "festival", Sports: "sports", "Arts & Theatre": "theatre" }[category];
    await query(`INSERT INTO events (slug,title,category,venue,city,starts_at,description,image,transfer_policy_url,transfer_host,featured)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [slug, title, category, text(form, "venue", 2, 100), text(form, "city", 2, 80), date, text(form, "description", 10, 1500),
      image, policy.href, transfer.hostname, field(form, "featured") === "on"]);
  });
  message("/admin", "success", "Event published.");
}

export async function closeEvent(form: FormData) {
  await requireUser("/admin", "admin");
  await attempt("/admin", async () => {
    const active = field(form, "active");
    if (active !== "true" && active !== "false") throw new ActionError("Invalid action.");
    await query("UPDATE events SET active=$2 WHERE id=$1", [id(form), active === "true"]);
  });
  message("/admin", "success", "Event visibility updated.");
}

export async function onboarding() {
  const user = await requireUser("/sell", "seller");
  const url = await attempt("/sell", async () => {
    if (paymentMode() !== "stripe") throw new ActionError("Stripe onboarding is unavailable.");
    const stripe = stripeClient();
    let account = user.stripe_account;
    if (!account) {
      const created = await stripe.accounts.create({
        type: "express", country: "MY", email: user.email, capabilities: { transfers: { requested: true } },
      }, { idempotencyKey: `seller-account-${user.id}` });
      account = created.id;
      await query("UPDATE users SET stripe_account=$2 WHERE id=$1 AND stripe_account IS NULL", [user.id, account]);
    }
    const link = await stripe.accountLinks.create({
      type: "account_onboarding", account, refresh_url: `${appUrl()}/sell?connect=refresh`, return_url: `${appUrl()}/sell?connect=return`,
    });
    return link.url;
  });
  redirect(url);
}

export async function resendVerification() {
  const user = await requireUser();
  await attempt("/account", async () => {
    if (!user.email_verified) {
      if (!(await authAllowed(user.email))) throw new ActionError("Too many attempts. Try again in 15 minutes.");
      await sendAccountLink(user, "verify");
    }
  });
  message("/account", "success", "Check your email for the verification link.");
}

export async function requestPasswordReset(form: FormData) {
  const path = "/account/recover";
  await attempt(path, async () => {
    const email = field(form, "email").toLowerCase();
    if (!mailConfigured()) throw new ActionError("Account email is temporarily unavailable.");
    if (!emailSchema.safeParse(email).success) throw new ActionError("Enter a valid email.");
    if (!(await authAllowed(email))) throw new ActionError("Too many attempts. Try again in 15 minutes.");
    const [user] = await query<{ id: string; email: string }>("SELECT id,email FROM users WHERE email=$1", [email]);
    if (user) {
      try { await sendAccountLink(user, "reset"); }
      catch (error) { console.error("Reset email could not be sent", error instanceof Error ? error.message : error); }
    }
  });
  message(path, "success", "If there’s an account for that address, you’ll receive a reset link.");
}

export async function verifyEmail(form: FormData) {
  await attempt("/account/verify", () => consumeAccountLink(field(form, "token"), "verify"));
  message("/account", "success", "Email verified.");
}

export async function resetPassword(form: FormData) {
  const token = field(form, "token");
  const path = /^[a-f0-9]{64}$/.test(token) ? `/account/reset?token=${token}` : "/account/reset";
  await attempt(path, async () => {
    const password = String(form.get("password") ?? "");
    if (password.length < 12 || password.length > 128) throw new ActionError("Use a password with 12–128 characters.");
    await consumeAccountLink(token, "reset", password);
    await clearSession();
  });
  message("/account", "success", "Password updated. Sign in with your new password.");
}

export async function refreshPayouts() {
  const user = await requireUser("/sell", "seller");
  const ready = await attempt("/sell", async () => {
    if (paymentMode() !== "stripe" || !user.stripe_account) throw new ActionError("Start Stripe onboarding first.");
    const account = await stripeClient().accounts.retrieve(user.stripe_account);
    const enabled = !("deleted" in account) && account.payouts_enabled && account.capabilities?.transfers === "active";
    await query("UPDATE users SET stripe_ready=$2 WHERE id=$1", [user.id, enabled]);
    return enabled;
  });
  message("/sell", ready ? "success" : "error", ready ? "Stripe payouts are ready." : "Stripe still requires information or verification.");
}

export async function supportConfirmDelivery(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  const admin = await requireUser(path, "admin");
  await attempt(path, async () => {
    const [updated] = await query(`UPDATE orders o SET status='confirmed',support_resolution=$2,support_confirmed_by=$3,support_confirmed_at=now()
      FROM listings l JOIN events e ON e.id=l.event_id
      WHERE o.id=$1 AND o.listing_id=l.id AND o.status='delivered' AND o.settled_at IS NULL
        AND e.starts_at+interval '24 hours'<=now() RETURNING o.id`,
    [order, text(form, "resolution", 10, 1000), admin.id]);
    if (!updated) throw new ActionError("Support can confirm delivery 24 hours after the event starts.");
  });
  message(path, "success", "Support delivery confirmation recorded.");
}

export async function supportOpenRefund(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  await requireUser(path, "admin");
  await attempt(path, async () => {
    const [updated] = await query(`UPDATE orders SET pre_refund_status=status,status='refund_requested',refund_reason=$2
      WHERE id=$1 AND status IN ('paid','delivered','confirmed') AND settled_at IS NULL RETURNING id`,
    [order, text(form, "reason", 5, 500)]);
    if (!updated) throw new ActionError("Review the payment and transfer in Stripe for this order.");
  });
  message(path, "success", "Refund opened for review.");
}

export async function cancelOrder(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  const user = await requireUser(path);
  const cancelled = await attempt(path, () => cancelReservation(order, user.id));
  if (!cancelled) message(path, "error", "Checkout is already complete or the payment is processing.");
  message(path, "success", "Reservation cancelled. The tickets are available again.");
}
