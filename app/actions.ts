"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authAllowed, clearSession, createSession, passwordHash, passwordMatches, requireUser } from "@/lib/auth";
import { appUrl, paymentMode } from "@/lib/config";
import { query, tx } from "@/lib/db";
import { consumeAccountLink, mailConfigured, sendAccountLink } from "@/lib/identity";
import { categories, uuid } from "@/lib/format";
import { deleteMedia, readImage, storeMedia } from "@/lib/media";
import { notify } from "@/lib/notify";
import { deleteObject, storePrivate } from "@/lib/storage";
import type { MessageKey } from "@/lib/messages";
import { ActionError, confirmDemo, orderById, reserve, submitReceipt, verifyManualPayment } from "@/lib/orders";
import { approveRefund, cancelReservation, checkout, settle, stripeClient } from "@/lib/stripe";

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const id = (form: FormData, key = "id") => {
  const value = field(form, key);
  if (!uuid.test(value)) throw new ActionError("err.invalid");
  return value;
};
const text = (form: FormData, key: string, min: number, max: number) => {
  const value = field(form, key);
  if (value.length < min || value.length > max) throw new ActionError("err.text");
  return value;
};
const optional = (form: FormData, key: string, max: number) => {
  const value = field(form, key);
  if (value.length > max) throw new ActionError("err.text");
  return value || null;
};
function scaled(form: FormData, key: string, min: number, max: number, decimals = false) {
  const value = field(form, key);
  if (!(decimals ? /^\d+(\.\d{1,2})?$/ : /^\d+$/).test(value)) throw new ActionError("err.number");
  const number = Math.round(Number(value) * (decimals ? 100 : 1));
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new ActionError("err.number");
  return number;
}
function safeNext(value: string) {
  return /^\/(account|sell|admin|events\/[a-z0-9-]+|orders\/[a-f0-9-]+)$/.test(value) ? value : "/account";
}
function httpsUrl(value: string) {
  if (value.length > 1500) throw new ActionError("err.urlLong");
  let url: URL;
  try { url = new URL(value); } catch { throw new ActionError("err.url"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new ActionError("err.url");
  return url;
}
/** Malaysian numbers typed as 012… become 6012…; stored as digits only. */
function phone(form: FormData) {
  let digits = field(form, "phone").replace(/[\s()+-]/g, "");
  if (digits.startsWith("0")) digits = `6${digits}`;
  if (!/^[0-9]{8,15}$/.test(digits)) throw new ActionError("err.phone");
  return digits;
}
function message(path: string, key: "error" | "success", value: MessageKey): never {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, value);
  redirect(url.pathname + url.search);
}
async function attempt<T>(path: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ActionError) message(path, "error", error.key);
    console.error("Marketplace action failed", error instanceof Error ? error.message : error);
    message(path, "error", "err.generic");
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
    if (!emailSchema.safeParse(email).success || password.length > 128) throw new ActionError("err.credentials");
    if (!(await authAllowed(email))) throw new ActionError("err.tooMany");
    const [user] = await query<{ id: string; password_hash: string; banned_at: Date | null }>("SELECT id,password_hash,banned_at FROM users WHERE email=$1", [email]);
    if (!passwordMatches(password, user?.password_hash ?? dummyHash) || !user) throw new ActionError("err.credentials");
    if (user.banned_at) throw new ActionError("err.banned");
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
    if (!emailSchema.safeParse(email).success) throw new ActionError("err.email");
    if (password.length < 12 || password.length > 128) throw new ActionError("err.passwordLength");
    if (field(form, "agree") !== "on") throw new ActionError("err.agree");
    if (!(await authAllowed(email))) throw new ActionError("err.tooMany");
    const demo = paymentMode() === "demo";
    if (!demo && !mailConfigured()) throw new ActionError("err.registration");
    const [user] = await query<{ id: string }>(`INSERT INTO users (name,email,password_hash,email_verified,terms_accepted_at)
      VALUES ($1,$2,$3,$4,now()) ON CONFLICT (email) DO NOTHING RETURNING id`, [name, email, passwordHash(password), demo]);
    if (!user) throw new ActionError("err.accountExists");
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

export async function requestSelling(form: FormData) {
  const user = await requireUser("/sell");
  await attempt("/account", async () => {
    if (!user.email_verified) throw new ActionError("err.verifyFirst");
    await query("UPDATE users SET seller_requested=true,phone=$2 WHERE id=$1 AND role='buyer'", [user.id, phone(form)]);
  });
  await notify.admin("新的卖家申请 / New seller application", "/admin", `${user.name} · ${user.email}`);
  message("/account", "success", "ok.sellerApplied");
}

export async function approveSeller(form: FormData) {
  await requireUser("/admin", "admin");
  await attempt("/admin", async () => {
    const [updated] = await query("UPDATE users SET role='seller',seller_requested=false WHERE id=$1 AND role='buyer' AND seller_requested RETURNING id", [id(form)]);
    if (!updated) throw new ActionError("err.applicationClosed");
  });
  message("/admin", "success", "ok.sellerApproved");
}

export async function savePayout(form: FormData) {
  const user = await requireUser("/sell", "seller");
  await attempt("/sell", async () => {
    const bank = text(form, "bank", 2, 60);
    const name = text(form, "holder", 2, 80);
    const account = text(form, "account", 4, 40);
    await query("UPDATE users SET payout_bank=$2,payout_name=$3,payout_account=$4 WHERE id=$1", [user.id, bank, name, account]);
  });
  message("/sell", "success", "ok.payoutSaved");
}

export async function startCheckout(form: FormData) {
  const path = safeNext(`/events/${field(form, "slug")}`);
  const user = await requireUser(path);
  if (!user.email_verified) message("/account", "error", "err.verifyBeforeBuying");
  const orderId = await attempt(path, () => reserve(id(form), user.id, scaled(form, "quantity", 1, 10)));
  redirect(`/orders/${orderId}`);
}

export async function payOrder(form: FormData) {
  const orderId = id(form);
  const path = `/orders/${orderId}`;
  const user = await requireUser(path);
  const url = await attempt(path, async () => {
    const order = await orderById(orderId);
    if (!order || order.buyer_id !== user.id) throw new ActionError("err.orderUnavailable");
    if (order.payment_mode === "demo") {
      await confirmDemo(orderId, user.id);
      await notify.paid(orderId);
      return null;
    }
    if (order.payment_mode !== "stripe") throw new ActionError("err.cannotPay");
    return checkout(orderId, user.id);
  });
  redirect(url ?? path);
}

export async function uploadReceipt(form: FormData) {
  const orderId = id(form);
  const path = `/orders/${orderId}`;
  const user = await requireUser(path);
  const accepted = await attempt(path, async () => {
    const image = await readImage(form.get("receipt"), { width: 1600, height: 2400 });
    if (!image) throw new ActionError("err.imageType");
    const remote = await storePrivate("receipts", image, "webp", "image/webp");
    try {
      const saved = await submitReceipt(orderId, user.id, { file: remote ? null : image, path: remote });
      if (!saved && remote) await deleteObject("private", remote);
      return saved;
    } catch (error) {
      if (remote) await deleteObject("private", remote);
      throw error;
    }
  });
  if (!accepted) message(path, "error", "err.reservationExpired");
  await notify.admin("新付款待核对 / Payment to verify", path, user.email);
  message(path, "success", "ok.receiptUploaded");
}

export async function verifyPayment(form: FormData) {
  const orderId = id(form);
  const path = `/orders/${orderId}`;
  await requireUser(path, "admin");
  const approve = field(form, "decision") === "approve";
  await attempt(path, () => verifyManualPayment(orderId, approve, approve ? optional(form, "reference", 120) ?? "" : text(form, "reason", 3, 300)));
  await (approve ? notify.paid(orderId) : notify.rejected(orderId));
  message(path, "success", approve ? "ok.paymentVerified" : "ok.paymentRejected");
}

export async function deliverOrder(form: FormData) {
  const orderId = id(form);
  const path = `/orders/${orderId}`;
  const user = await requireUser(path, "seller");
  await attempt(path, async () => {
    const order = await orderById(orderId);
    if (!order || order.seller_id !== user.id) throw new ActionError("err.orderUnavailable");
    const reference = text(form, "reference", 2, 180);
    const link = field(form, "link") ? httpsUrl(field(form, "link")) : null;
    if (link && link.hostname !== order.transfer_host) throw new ActionError("err.officialDomain");
    const [updated] = await query(`UPDATE orders SET status='delivered',transfer_ref=$2,transfer_url=$3,delivered_at=now()
      WHERE id=$1 AND status='paid' RETURNING id`, [orderId, reference, link?.href ?? null]);
    if (!updated) throw new ActionError("err.cannotTransfer");
  });
  await notify.transferred(orderId);
  message(path, "success", "ok.transferRecorded");
}

export async function confirmReceipt(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  const user = await requireUser(path);
  await attempt(path, async () => {
    const [updated] = await query("UPDATE orders SET status='confirmed' WHERE id=$1 AND buyer_id=$2 AND status='delivered' RETURNING id", [order, user.id]);
    if (!updated) throw new ActionError("err.cannotConfirm");
  });
  message(path, "success", "ok.receiptConfirmed");
}

export async function requestRefund(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  const user = await requireUser(path);
  await attempt(path, async () => {
    const [updated] = await query(`UPDATE orders SET pre_refund_status=status,status='refund_requested',refund_reason=$3,
      refund_account=coalesce($4,refund_account)
      WHERE id=$1 AND buyer_id=$2 AND status IN ('paid','delivered','confirmed') AND settled_at IS NULL RETURNING id`,
    [order, user.id, text(form, "reason", 5, 500), optional(form, "account", 200)]);
    if (!updated) throw new ActionError("err.manualSupport");
  });
  await notify.admin("退款申请 / Refund requested", path, user.email);
  message(path, "success", "ok.refundRequested");
}

export async function reviewRefund(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  await requireUser(path, "admin");
  await attempt(path, async () => {
    if (field(form, "decision") === "approve") await approveRefund(order, field(form, "reference").slice(0, 120));
    else {
      const [updated] = await query(`UPDATE orders SET status=pre_refund_status,pre_refund_status=NULL
        WHERE id=$1 AND status='refund_requested' AND pre_refund_status IS NOT NULL RETURNING id`, [order]);
      if (!updated) throw new ActionError("err.requestChanged");
    }
  });
  const [after] = await query<{ status: string }>("SELECT status FROM orders WHERE id=$1", [order]);
  if (after?.status === "refunded") await notify.refunded(order);
  message(path, "success", "ok.refundReviewed");
}

export async function settleOrder(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  await requireUser(path, "admin");
  await attempt(path, () => settle(order, field(form, "reference").slice(0, 120)));
  await notify.settled(order);
  message(path, "success", "ok.settled");
}

export async function createListing(form: FormData) {
  const user = await requireUser("/sell", "seller");
  await attempt("/sell", async () => {
    const event = id(form, "event");
    const quantity = scaled(form, "quantity", 1, 100);
    const price = scaled(form, "price", 200, 2500000, true);
    if (!/^\d+(\.\d{1,2})?$/.test(field(form, "face"))) throw new ActionError("err.faceValue");
    const face = scaled(form, "face", 100, 2500000, true);
    const [{ max_markup_bps: cap }] = await query<{ max_markup_bps: number | null }>("SELECT max_markup_bps FROM fee_settings");
    if (cap !== null && price > face + Math.floor((face * cap) / 10000)) throw new ActionError("err.overCap");
    const attachment = form.get("attachment");
    let proofFile: Buffer | null = null;
    let proofType: string | null = null;
    if (attachment instanceof File && attachment.size > 0) {
      if (attachment.size > 2097152) throw new ActionError("err.proofSize");
      proofFile = Buffer.from(await attachment.arrayBuffer());
      if (proofFile.subarray(0, 5).toString() === "%PDF-") proofType = "application/pdf";
      else if (proofFile.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") proofType = "image/png";
      else if (proofFile.subarray(0, 3).toString("hex") === "ffd8ff") proofType = "image/jpeg";
      else throw new ActionError("err.proofType");
    }
    const section = text(form, "section", 2, 80);
    const proof = text(form, "proof", 5, 1000);
    const proofPath = proofFile && proofType ? await storePrivate("proofs", proofFile, { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" }[proofType]!, proofType) : null;
    const [listing] = await query(`INSERT INTO listings (event_id,seller_id,section,price,face_value,quantity,available,proof,proof_file,proof_path,proof_type)
      SELECT id,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10 FROM events WHERE id=$1 AND active AND starts_at>now()+interval '45 minutes' RETURNING id`,
    [event, user.id, section, price, face, quantity, proof, proofPath ? null : proofFile, proofPath, proofType]);
    if (!listing) {
      if (proofPath) await deleteObject("private", proofPath);
      throw new ActionError("err.eventUnavailable");
    }
  });
  await notify.admin("新挂单待审核 / Listing to review", "/admin", user.name);
  message("/sell", "success", "ok.listingSubmitted");
}

export async function reviewListing(form: FormData) {
  await requireUser("/admin", "admin");
  await attempt("/admin", async () => {
    const status = field(form, "decision");
    if (!["active","rejected","paused"].includes(status)) throw new ActionError("err.decision");
    const [updated] = await query<{ event_id: string; was: string }>(`UPDATE listings l SET status=$2,paused_by_admin=($2='paused'),updated_at=now()
      FROM (SELECT id,status AS was FROM listings WHERE id=$1 FOR UPDATE) old WHERE l.id=old.id AND
      (($2='rejected' AND l.status='pending') OR ($2='paused' AND l.status='active') OR ($2='active' AND l.status IN ('pending','paused')))
      RETURNING l.event_id,old.was`, [id(form), status]);
    if (!updated) throw new ActionError("err.listingChanged");
    if (status === "active" && updated.was === "pending") await notify.newTickets(updated.event_id);
  });
  message("/admin", "success", "ok.listingUpdated");
}

export async function pauseListing(form: FormData) {
  const user = await requireUser("/sell", "seller");
  await attempt("/sell", async () => {
    const status = field(form, "decision");
    if (!["active","paused"].includes(status)) throw new ActionError("err.decision");
    const [updated] = await query(`UPDATE listings SET status=$3 WHERE id=$1 AND seller_id=$2 AND
      (($3='paused' AND status='active') OR ($3='active' AND status='paused' AND paused_by_admin=false)) RETURNING id`,
    [id(form), user.id, status]);
    if (!updated) throw new ActionError("err.needsAdmin");
  });
  message("/sell", "success", "ok.listingUpdated");
}

export async function updateFees(form: FormData) {
  await requireUser("/admin", "admin");
  const path = "/admin?tab=settings";
  await attempt(path, async () => {
    const cap = field(form, "max markup") === "" ? null : scaled(form, "max markup", 0, 100000, true);
    await query("UPDATE fee_settings SET buyer_bps=$1,seller_bps=$2,max_markup_bps=$3",
      [scaled(form, "buyer fee", 0, 3000, true), scaled(form, "seller fee", 0, 3000, true), cap]);
  });
  message(path, "success", "ok.ratesUpdated");
}

export async function savePaymentSettings(form: FormData) {
  await requireUser("/admin", "admin");
  const path = "/admin?tab=settings";
  await attempt(path, async () => {
    const qr = await readImage(form.get("qr"), { width: 1000, height: 1400, lossless: true });
    const values = [optional(form, "bank", 60), optional(form, "holder", 80), optional(form, "account", 40),
      optional(form, "duitnow", 60), optional(form, "note", 300)];
    await tx(async (client) => {
      await client.query("UPDATE payment_settings SET bank_name=$1,account_name=$2,account_number=$3,duitnow_id=$4,note=$5", values);
      if (qr) {
        const { rows: [old] } = await client.query<{ qr_id: string | null }>("SELECT qr_id FROM payment_settings FOR UPDATE");
        await client.query("UPDATE payment_settings SET qr_id=$1", [await storeMedia(client, qr)]);
        if (old.qr_id) await deleteMedia(client, old.qr_id);
      }
    });
  });
  message(path, "success", "ok.paymentSettings");
}

async function eventFields(form: FormData, requireUpcoming: boolean) {
  const title = text(form, "title", 3, 100);
  const category = field(form, "category");
  const start = field(form, "start");
  const date = new Date(start + ":00+08:00");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) || Number.isNaN(date.getTime()) ||
      (requireUpcoming && !(date.getTime() > Date.now() + 2700000))) throw new ActionError("err.upcomingDate");
  if (!categories.some((value) => value === category)) throw new ActionError("err.category");
  const policy = httpsUrl(field(form, "policy"));
  const transfer = httpsUrl(field(form, "transfer site"));
  const image = { Concerts: "concert", Festivals: "festival", Sports: "sports", "Arts & Theatre": "theatre" }[category];
  const poster = await readImage(form.get("poster"), { width: 1200, height: 1600 });
  const seatmap = await readImage(form.get("seatmap"), { width: 2000, height: 2000 });
  return {
    title, category, image, date, policy: policy.href, transferHost: transfer.hostname, poster, seatmap,
    address: optional(form, "address", 200),
    venue: text(form, "venue", 2, 100), city: text(form, "city", 2, 80), description: text(form, "description", 10, 1500),
    featured: field(form, "featured") === "on",
  };
}

export async function createEvent(form: FormData) {
  await requireUser("/admin", "admin");
  const path = "/admin?tab=events";
  await attempt(path, async () => {
    const event = await eventFields(form, true);
    const slug = (event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65) || "event") + "-" + randomBytes(4).toString("hex");
    await tx(async (client) => {
      const poster = event.poster ? await storeMedia(client, event.poster) : null;
      const seatmap = event.seatmap ? await storeMedia(client, event.seatmap) : null;
      await client.query(`INSERT INTO events (slug,title,category,venue,city,starts_at,description,image,transfer_policy_url,transfer_host,featured,poster_id,seatmap_id,venue_address)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [slug, event.title, event.category, event.venue, event.city, event.date, event.description, event.image,
        event.policy, event.transferHost, event.featured, poster, seatmap, event.address]);
    });
  });
  message(path, "success", "ok.eventPublished");
}

export async function updateEvent(form: FormData) {
  await requireUser("/admin", "admin");
  const eventId = id(form);
  const path = `/admin/events/${eventId}`;
  await attempt(path, async () => {
    const event = await eventFields(form, false);
    await tx(async (client) => {
      const { rows: [current] } = await client.query<{ poster_id: string | null; seatmap_id: string | null }>(
        "SELECT poster_id,seatmap_id FROM events WHERE id=$1 FOR UPDATE", [eventId]);
      if (!current) throw new ActionError("err.eventUnavailable");
      const poster = event.poster ? await storeMedia(client, event.poster) : current.poster_id;
      const seatmap = event.seatmap ? await storeMedia(client, event.seatmap) : current.seatmap_id;
      await client.query(`UPDATE events SET title=$2,category=$3,venue=$4,city=$5,starts_at=$6,description=$7,image=$8,
        transfer_policy_url=$9,transfer_host=$10,featured=$11,poster_id=$12,seatmap_id=$13,venue_address=$14 WHERE id=$1`,
      [eventId, event.title, event.category, event.venue, event.city, event.date, event.description, event.image,
        event.policy, event.transferHost, event.featured, poster, seatmap, event.address]);
      if (event.poster && current.poster_id) await deleteMedia(client, current.poster_id);
      if (event.seatmap && current.seatmap_id) await deleteMedia(client, current.seatmap_id);
    });
  });
  message(path, "success", "ok.eventSaved");
}

export async function closeEvent(form: FormData) {
  await requireUser("/admin", "admin");
  const path = "/admin?tab=events";
  await attempt(path, async () => {
    const active = field(form, "active");
    if (active !== "true" && active !== "false") throw new ActionError("err.decision");
    await query("UPDATE events SET active=$2 WHERE id=$1", [id(form), active === "true"]);
  });
  message(path, "success", "ok.eventVisibility");
}

export async function onboarding() {
  const user = await requireUser("/sell", "seller");
  const url = await attempt("/sell", async () => {
    if (paymentMode() !== "stripe") throw new ActionError("err.stripeOnboarding");
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
      if (!(await authAllowed(user.email))) throw new ActionError("err.tooMany");
      await sendAccountLink(user, "verify");
    }
  });
  message("/account", "success", "ok.checkEmail");
}

export async function requestPasswordReset(form: FormData) {
  const path = "/account/recover";
  await attempt(path, async () => {
    const email = field(form, "email").toLowerCase();
    if (!mailConfigured()) throw new ActionError("err.emailUnavailable");
    if (!emailSchema.safeParse(email).success) throw new ActionError("err.email");
    if (!(await authAllowed(email))) throw new ActionError("err.tooMany");
    const [user] = await query<{ id: string; email: string }>("SELECT id,email FROM users WHERE email=$1", [email]);
    if (user) {
      try { await sendAccountLink(user, "reset"); }
      catch (error) { console.error("Reset email could not be sent", error instanceof Error ? error.message : error); }
    }
  });
  message(path, "success", "ok.resetSent");
}

export async function verifyEmail(form: FormData) {
  await attempt("/account/verify", () => consumeAccountLink(field(form, "token"), "verify"));
  message("/account", "success", "ok.emailVerified");
}

export async function resetPassword(form: FormData) {
  const token = field(form, "token");
  const path = /^[a-f0-9]{64}$/.test(token) ? `/account/reset?token=${token}` : "/account/reset";
  await attempt(path, async () => {
    const password = String(form.get("password") ?? "");
    if (password.length < 12 || password.length > 128) throw new ActionError("err.passwordLength");
    await consumeAccountLink(token, "reset", password);
    await clearSession();
  });
  message("/account", "success", "ok.passwordUpdated");
}

export async function refreshPayouts() {
  const user = await requireUser("/sell", "seller");
  const ready = await attempt("/sell", async () => {
    if (paymentMode() !== "stripe" || !user.stripe_account) throw new ActionError("err.startOnboarding");
    const account = await stripeClient().accounts.retrieve(user.stripe_account);
    const enabled = !("deleted" in account) && account.payouts_enabled && account.capabilities?.transfers === "active";
    await query("UPDATE users SET stripe_ready=$2 WHERE id=$1", [user.id, enabled]);
    return enabled;
  });
  if (ready) message("/sell", "success", "ok.payoutsReady");
  message("/sell", "error", "err.stripeNotReady");
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
    if (!updated) throw new ActionError("err.supportAfterEvent");
  });
  message(path, "success", "ok.supportConfirmed");
}

export async function supportOpenRefund(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  await requireUser(path, "admin");
  await attempt(path, async () => {
    const [updated] = await query(`UPDATE orders SET pre_refund_status=status,status='refund_requested',refund_reason=$2
      WHERE id=$1 AND status IN ('paid','delivered','confirmed') AND settled_at IS NULL RETURNING id`,
    [order, text(form, "reason", 5, 500)]);
    if (!updated) throw new ActionError("err.reviewInStripe");
  });
  message(path, "success", "ok.refundOpened");
}

export async function cancelOrder(form: FormData) {
  const order = id(form);
  const path = `/orders/${order}`;
  const user = await requireUser(path);
  const cancelled = await attempt(path, () => cancelReservation(order, user.id));
  if (!cancelled) message(path, "error", "err.checkoutComplete");
  message(path, "success", "ok.cancelled");
}

export async function toggleFavorite(form: FormData) {
  const eventId = id(form, "event");
  const back = field(form, "from") === "account" ? "/account?tab=favorites" : safeNext(`/events/${field(form, "slug")}`);
  const user = await requireUser(back.startsWith("/events/") ? back : "/account");
  await attempt(back, async () => {
    const removed = await query("DELETE FROM favorites WHERE user_id=$1 AND event_id=$2 RETURNING event_id", [user.id, eventId]);
    if (!removed.length) await query(`INSERT INTO favorites (user_id,event_id) SELECT $1,id FROM events WHERE id=$2 AND active
      ON CONFLICT DO NOTHING`, [user.id, eventId]);
  });
  redirect(back);
}

export async function submitReview(form: FormData) {
  const orderId = id(form);
  const path = `/orders/${orderId}`;
  const user = await requireUser(path);
  await attempt(path, async () => {
    const rating = scaled(form, "rating", 1, 5);
    const [saved] = await query(`INSERT INTO reviews (order_id,seller_id,buyer_id,rating,comment)
      SELECT o.id,l.seller_id,o.buyer_id,$3,$4 FROM orders o JOIN listings l ON l.id=o.listing_id
      WHERE o.id=$1 AND o.buyer_id=$2 AND o.status='confirmed' ON CONFLICT (order_id) DO NOTHING RETURNING order_id`,
    [orderId, user.id, rating, optional(form, "comment", 500)]);
    if (!saved) throw new ActionError("err.reviewUnavailable");
  });
  message(path, "success", "ok.reviewSaved");
}

export async function updateProfile(form: FormData) {
  const user = await requireUser("/account");
  const path = "/account?tab=profile";
  await attempt(path, async () => {
    const name = text(form, "name", 2, 80);
    const number = field(form, "phone") ? phone(form) : null;
    await query("UPDATE users SET name=$2,phone=$3 WHERE id=$1", [user.id, name, number]);
  });
  message(path, "success", "ok.profileSaved");
}

export async function changePassword(form: FormData) {
  const user = await requireUser("/account");
  const path = "/account?tab=profile";
  await attempt(path, async () => {
    const current = String(form.get("current") ?? "");
    const next = String(form.get("password") ?? "");
    if (next.length < 12 || next.length > 128) throw new ActionError("err.passwordLength");
    if (!(await authAllowed(user.email))) throw new ActionError("err.tooMany");
    const [row] = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [user.id]);
    if (!row || current.length > 128 || !passwordMatches(current, row.password_hash)) throw new ActionError("err.currentPassword");
    await query("UPDATE users SET password_hash=$2 WHERE id=$1", [user.id, passwordHash(next)]);
    await query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    await createSession(user.id);
  });
  message(path, "success", "ok.passwordChanged");
}

export async function updateListing(form: FormData) {
  const user = await requireUser("/sell", "seller");
  await attempt("/sell", async () => {
    const listing = id(form);
    const price = scaled(form, "price", 200, 2500000, true);
    const available = scaled(form, "available", 0, 100);
    const [{ max_markup_bps: cap }] = await query<{ max_markup_bps: number | null }>("SELECT max_markup_bps FROM fee_settings");
    const [updated] = await query(`UPDATE listings SET price=$3,quantity=quantity-(available-$4),available=$4,updated_at=now()
      WHERE id=$1 AND seller_id=$2 AND status IN ('pending','active','paused') AND available>=$4
        AND ($5::int IS NULL OR face_value IS NULL OR $3<=face_value+floor(face_value*$5/10000.0)) RETURNING id`,
    [listing, user.id, price, available, cap]);
    if (!updated) throw new ActionError("err.listingEdit");
  });
  message("/sell", "success", "ok.listingUpdated");
}

export async function closeListing(form: FormData) {
  const user = await requireUser("/sell", "seller");
  await attempt("/sell", async () => {
    const [closed] = await query(`UPDATE listings SET status='closed',updated_at=now()
      WHERE id=$1 AND seller_id=$2 AND status IN ('pending','active','paused') RETURNING id`, [id(form), user.id]);
    if (!closed) throw new ActionError("err.listingChanged");
  });
  message("/sell", "success", "ok.listingClosed");
}

export async function setBan(form: FormData) {
  const admin = await requireUser("/admin", "admin");
  const path = "/admin?tab=users";
  await attempt(path, async () => {
    const target = id(form);
    if (target === admin.id) throw new ActionError("err.decision");
    const ban = field(form, "ban") === "true";
    const [updated] = await query(`UPDATE users SET banned_at=${ban ? "now()" : "NULL"} WHERE id=$1 AND role<>'admin' RETURNING id`, [target]);
    if (!updated) throw new ActionError("err.decision");
    if (ban) await query("DELETE FROM sessions WHERE user_id=$1", [target]);
  });
  message(path, "success", "ok.userUpdated");
}
