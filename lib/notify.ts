import { query } from "./db";
import { money, shortId } from "./format";
import { mailConfigured } from "./identity";

/**
 * Transactional emails (bilingual). Best effort: a failed email is logged and never blocks
 * the order flow. Without RESEND_API_KEY / MAIL_FROM nothing is sent.
 */
const site = () => {
  try { return new URL(process.env.APP_URL ?? "http://localhost:3000").origin; } catch { return "http://localhost:3000"; }
};
const adminEmail = () => process.env.ADMIN_NOTIFY_EMAIL || process.env.SUPPORT_EMAIL || null;

export async function sendEmail(to: string | null | undefined, subject: string, lines: string[]) {
  if (!to || !mailConfigured()) return;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        from: process.env.MAIL_FROM, to: [to], subject: `Crazy Monkey 票务 · ${subject}`,
        text: [...lines, "", "—", "Crazy Monkey Tickets · 马来西亚安心门票转让平台", site()].join("\n"),
      }),
    });
    if (!response.ok) console.error("Notification email rejected", response.status);
  } catch (error) {
    console.error("Notification email failed", error instanceof Error ? error.message : error);
  }
}

type OrderContext = {
  id: string; title: string; section: string; quantity: number; subtotal: number; buyer_fee: number; seller_fee: number;
  buyer_email: string; seller_email: string; payout_ref: string | null; refund_ref: string | null; transfer_ref: string | null; reject_reason: string | null;
};

async function order(id: string) {
  const [row] = await query<OrderContext>(`SELECT o.id,e.title,l.section,o.quantity,o.subtotal,o.buyer_fee,o.seller_fee,
      u.email AS buyer_email,s.email AS seller_email,o.payout_ref,o.refund_ref,o.transfer_ref,o.reject_reason
    FROM orders o JOIN listings l ON l.id=o.listing_id JOIN events e ON e.id=l.event_id
    JOIN users u ON u.id=o.buyer_id JOIN users s ON s.id=l.seller_id WHERE o.id=$1`, [id]);
  return row;
}

const link = (id: string) => `${site()}/orders/${id}`;
const what = (o: OrderContext) => `${o.title} · ${o.quantity} × ${o.section} (${shortId(o.id)})`;

export const notify = {
  /** Payment confirmed: the buyer waits for the transfer and the seller must send it. */
  async paid(id: string) {
    const o = await order(id);
    if (!o) return;
    await Promise.all([
      sendEmail(o.buyer_email, "付款已确认 / Payment confirmed", [
        "你的付款已确认，卖家会尽快通过官方平台转票给你。", "Your payment is confirmed. The seller will transfer your tickets through the official provider.",
        "", what(o), link(o.id)]),
      sendEmail(o.seller_email, "门票已售出，请转票 / Tickets sold — please transfer", [
        `你的门票已售出，请尽快通过官方平台转票到买家邮箱：${o.buyer_email}，然后在订单页登记转票编号。`,
        `Your tickets sold. Please transfer them through the official provider to ${o.buyer_email}, then record the transfer reference.`,
        "", what(o), `实收 / Proceeds: ${money(o.subtotal - o.seller_fee)}`, link(o.id)]),
    ]);
  },
  async rejected(id: string) {
    const o = await order(id);
    if (o) await sendEmail(o.buyer_email, "付款未通过核对 / Payment not verified", [
      `我们没有核对到你的付款：${o.reject_reason ?? ""}`, `We couldn't verify your payment: ${o.reject_reason ?? ""}`,
      "如已转账，请联系客服。If you already paid, please contact support.", "", what(o), link(o.id)]);
  },
  async transferred(id: string) {
    const o = await order(id);
    if (o) await sendEmail(o.buyer_email, "卖家已转票 / Your tickets were transferred", [
      "卖家已登记转票。请在官方票务平台接收并核对门票，然后到订单页确认收到。",
      "The seller has recorded the transfer. Accept and check the tickets with the official provider, then confirm on your order page.",
      "", what(o), `转票编号 / Reference: ${o.transfer_ref ?? "-"}`, link(o.id)]);
  },
  async refunded(id: string) {
    const o = await order(id);
    if (o) await sendEmail(o.buyer_email, "退款已完成 / Refund completed", [
      `我们已退款 ${money(o.subtotal + o.buyer_fee)}。`, `We have refunded ${money(o.subtotal + o.buyer_fee)}.`,
      "", what(o), `退款编号 / Reference: ${o.refund_ref ?? "-"}`, link(o.id)]);
  },
  async settled(id: string) {
    const o = await order(id);
    if (o) await sendEmail(o.seller_email, "款项已结算 / Payout sent", [
      `我们已把 ${money(o.subtotal - o.seller_fee)} 转到你的收款账户。`, `We have sent ${money(o.subtotal - o.seller_fee)} to your payout account.`,
      "", what(o), `转账编号 / Reference: ${o.payout_ref ?? "-"}`, link(o.id)]);
  },
  /** Operator alerts. */
  async admin(subject: string, path: string, detail = "") {
    await sendEmail(adminEmail(), subject, [detail, `${site()}${path}`].filter(Boolean));
  },
  /** Tells people who saved an event that new tickets are listed (at most once a day per person). */
  async newTickets(eventId: string) {
    const recipients = await query<{ email: string; title: string; slug: string }>(`
      WITH due AS (
        UPDATE favorites f SET notified_at=now() FROM users u
        WHERE f.event_id=$1 AND u.id=f.user_id AND u.banned_at IS NULL AND (f.notified_at IS NULL OR f.notified_at<now()-interval '1 day')
        RETURNING u.email)
      SELECT due.email,e.title,e.slug FROM due CROSS JOIN events e WHERE e.id=$1 LIMIT 200`, [eventId]);
    for (const person of recipients) {
      await sendEmail(person.email, `${person.title} 有新票 / New tickets`, [
        `你收藏的活动「${person.title}」有新的门票上架了。`, `New tickets were just listed for ${person.title}, an event you saved.`,
        "", `${site()}/events/${person.slug}`]);
    }
  },
};
