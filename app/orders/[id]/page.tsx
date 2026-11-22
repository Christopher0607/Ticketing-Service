import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, LockKeyhole, MapPin, MessageCircle, QrCode, Ticket, Upload, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { mediaUrl, money, percent, posterUrl, shortId, uuid } from "@/lib/format";
import { i18n, type MessageKey } from "@/lib/i18n";
import { paymentConfigured, paymentSettings } from "@/lib/market";
import { orderById } from "@/lib/orders";
import {
  cancelOrder, confirmReceipt, deliverOrder, payOrder, requestRefund, reviewRefund, settleOrder, supportConfirmDelivery,
  submitReview, supportOpenRefund, uploadReceipt, verifyPayment,
} from "../../actions";
import { CopyButton, Countdown, ImageField, PaymentRefresh } from "../../client";
import { Notice, Stars, Status, SupportLinks } from "../../ui";
import { query } from "@/lib/db";

export const metadata = { title: "Order" };

const stepKeys: MessageKey[] = ["order.step.pay", "order.step.transfer", "order.step.confirm", "order.step.settle"];
const stepIndex: Record<string, number> = { reserved: 0, verifying: 0, paid: 1, delivered: 2, confirmed: 3 };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string; payment?: string }> }) {
  const [{ id }, notice, { t, f }] = await Promise.all([params, searchParams, i18n()]);
  if (!uuid.test(id)) notFound();
  const user = await requireUser(`/orders/${id}`);
  const order = await orderById(id);
  if (!order) notFound();
  const buyer = order.buyer_id === user.id;
  const seller = order.seller_id === user.id;
  const admin = user.role === "admin";
  if (!buyer && !seller && !admin) notFound();
  if (seller && !admin && ["reserved", "verifying", "expired", "cancelled"].includes(order.status)) notFound();
  const manual = order.payment_mode === "manual";
  const deadline = order.expires_at.getTime() - (order.payment_mode === "stripe" && !order.checkout_attempted ? 1800000 : 0);
  const expired = order.status === "expired" || (order.status === "reserved" && deadline <= Date.now());
  const awaitingPayment = order.status === "reserved" && !expired;
  const canViewTransfer = (buyer || admin) && !!order.transfer_ref && ["delivered","confirmed"].includes(order.status);
  const afterEvent = order.starts_at.getTime() + 86400000 <= Date.now();
  const pendingStripe = buyer && notice.payment === "returned" && !expired && order.payment_mode === "stripe" && order.status === "reserved";
  const refundAllowed = ["paid","delivered","confirmed"].includes(order.status) && !order.settled_at;
  const total = order.subtotal + order.buyer_fee;
  const step = order.settled_at ? 4 : stepIndex[order.status];
  const pay = manual && buyer && awaitingPayment ? await paymentSettings() : null;
  const [review] = order.status === "confirmed" && (buyer || seller || admin)
    ? await query<{ rating: number; comment: string | null }>("SELECT rating,comment FROM reviews WHERE order_id=$1", [order.id]) : [];
  const reference = `CM-${shortId(order.id)}`;
  const shownStatus = expired ? "expired" : order.settled_at && order.status === "confirmed" ? "settled" : order.status;
  return <div className="shell page">
    <Link className="back-link" href={admin ? "/admin" : seller ? "/sell" : "/account"}><ChevronLeft size={18} /> {admin ? t("order.backAdmin") : seller ? t("order.backSeller") : t("order.backBuyer")}</Link>
    <div className="page-heading heading-split"><div><h1>{awaitingPayment && buyer ? t("order.checkout") : t("order.details")}</h1><p>{t("order.number", { id: shortId(order.id) })}</p></div>
      <Status t={t} value={shownStatus} /></div>
    <Notice t={t} {...notice} />
    {step !== undefined && !expired && <ol className="stepper" aria-label={t("order.details")}>
      {stepKeys.map((key, index) => <li key={key} className={index < step ? "done" : index === step ? "current" : undefined} aria-current={index === step ? "step" : undefined}>
        <span className="step-dot">{index < step ? <Check size={14} /> : index + 1}</span><span>{t(key)}</span>
      </li>)}
    </ol>}
    <div className="detail-grid">
      <section className="row-list">
        <div className="panel order-event"><div className="order-image"><img src={posterUrl(order)} alt="" /></div>
          <div><h2>{order.title}</h2><p><CalendarDays size={16} /> {f.date(order.starts_at)} · {f.time(order.starts_at)}</p><p><MapPin size={16} /> {order.venue}</p><p><Ticket size={16} /> {order.quantity} × {order.section}</p></div>
        </div>

        {pay && <div className="panel pay-panel">
          <div className="pay-head"><h2><QrCode size={20} /> {t("pay.title")}</h2><Countdown until={deadline} label={t("order.holdUntil", { time: f.time(new Date(deadline)) })} /></div>
          {paymentConfigured(pay) ? <>
            <div className="pay-amount"><span>{t("pay.amount")}</span><strong>{money(total)}</strong><CopyButton value={(total / 100).toFixed(2)} label={t("pay.copy")} done={t("pay.copied")} /></div>
            <p>{t("pay.exact")}</p>
            <div className="pay-grid">
              {pay.qr_id && <figure className="pay-qr"><img src={mediaUrl(pay.qr_id, pay.qr_remote)} alt="DuitNow QR" /><figcaption>{t("pay.qr")}</figcaption></figure>}
              <dl className="pay-details">
                <div><dt>{t("pay.reference")}</dt><dd><strong>{reference}</strong><CopyButton value={reference} label={t("pay.copy")} done={t("pay.copied")} /></dd></div>
                {pay.duitnow_id && <div><dt>{t("pay.duitnow")}</dt><dd>{pay.duitnow_id}<CopyButton value={pay.duitnow_id} label={t("pay.copy")} done={t("pay.copied")} /></dd></div>}
                {pay.bank_name && <div><dt>{t("pay.bank")}</dt><dd>{pay.bank_name}</dd></div>}
                {pay.account_name && <div><dt>{t("pay.accountName")}</dt><dd>{pay.account_name}</dd></div>}
                {pay.account_number && <div><dt>{t("pay.accountNumber")}</dt><dd>{pay.account_number}<CopyButton value={pay.account_number.replace(/\s/g, "")} label={t("pay.copy")} done={t("pay.copied")} /></dd></div>}
              </dl>
            </div>
            {pay.note && <p className="pay-note wrap">{pay.note}</p>}
            <form action={uploadReceipt} className="form-stack upload-form">
              <input type="hidden" name="id" value={id} />
              <ImageField name="receipt" label={t("pay.receipt")} hint={t("pay.receiptHint")} required maxSide={1800} />
              <button className="button primary"><Upload size={17} /> {t("pay.upload")}</button>
            </form>
          </> : <p>{t("pay.notConfigured")}</p>}
        </div>}

        {order.status === "verifying" && (buyer || admin) && <div className="panel verify-panel">
          <h2>{t("pay.verifyTitle")}</h2>
          {buyer && <p role="status">{t("pay.verifying")}</p>}
          {order.has_receipt && (admin ? <a href={`/api/orders/${id}/receipt`} target="_blank" rel="noreferrer" className="receipt-preview"><img src={`/api/orders/${id}/receipt`} alt={t("pay.viewReceipt")} /></a> :
            <a className="text-link" href={`/api/orders/${id}/receipt`} target="_blank" rel="noreferrer">{t("pay.viewReceipt")}</a>)}
          {admin && <div className="verify-actions">
            <form action={verifyPayment} className="form-stack"><input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="approve" />
              <p className="verify-amount">{t("pay.amount")} <strong>{money(total)}</strong> · {reference}</p>
              <label>{t("pay.paymentRef")}<input name="reference" maxLength={120} /></label>
              <button className="button primary"><Check size={17} /> {t("pay.approve")}</button></form>
            <details><summary>{t("pay.reject")}</summary><form action={verifyPayment} className="form-stack"><input type="hidden" name="id" value={id} /><input type="hidden" name="decision" value="reject" />
              <label>{t("pay.rejectReason")}<textarea name="reason" required minLength={3} maxLength={300} /></label>
              <button className="button outline">{t("pay.reject")}</button></form></details>
          </div>}
        </div>}

        {order.status === "cancelled" && order.reject_reason && (buyer || admin) && <p className="notice error" role="alert">{t("pay.rejected", { reason: order.reject_reason })}</p>}
        {expired && buyer && <p className="notice">{t("order.expired")}</p>}

        {!["reserved","verifying","expired","cancelled"].includes(order.status) || (buyer && awaitingPayment && !manual) ? <div className="panel">
          <h2>{t("order.transfer")}</h2>
          {pendingStripe && <PaymentRefresh text={t("order.waitingStripe")} />}
          {order.status === "reserved" ? <><p>{t("order.held")}</p><Countdown until={deadline} label={t("order.holdUntil", { time: f.time(new Date(deadline)) })} /></> :
            order.status === "paid" ? <p>{seller ? t("order.sellerSend") : t("order.buyerWait")}</p> : null}
          {buyer && order.status === "paid" && <p>{t("order.transferEmail")} <strong>{order.buyer_email}</strong></p>}
          {seller && order.status === "paid" && <form className="form-stack" action={deliverOrder}>
            <input type="hidden" name="id" value={id} /><p>{t("order.sendTo")} <strong>{order.buyer_name} · {order.buyer_email}</strong></p>
            <label>{t("order.reference")}<input name="reference" minLength={2} maxLength={180} required /></label>
            <label>{t("order.link")}<input name="link" type="url" placeholder={order.transfer_host ? `https://${order.transfer_host}/…` : undefined} maxLength={1500} /></label>
            <button className="button primary">{t("order.record")}</button>
          </form>}
          {canViewTransfer && <p>{t("order.reference")} <strong>{order.transfer_ref}</strong></p>}
          {canViewTransfer && order.transfer_url && <p><a className="text-link" href={order.transfer_url} target="_blank" rel="noreferrer">{t("order.openTransfer")}</a></p>}
          {order.status === "delivered" && buyer && <form action={confirmReceipt} className="form-stack">
            <p>{t("order.confirmHint")}</p>
            <input type="hidden" name="id" value={id} /><button className="button primary"><Check size={17} /> {t("order.confirm")}</button>
          </form>}
          {order.status === "confirmed" && <p className="confirmed-line"><Check size={16} /> {order.support_confirmed_at ? t("order.confirmedSupport") : t("order.confirmed")}</p>}
          {admin && order.support_resolution && <p className="wrap">{order.support_resolution}</p>}
          {admin && order.status === "delivered" && afterEvent && <details><summary>{t("order.supportConfirm")}</summary><form action={supportConfirmDelivery} className="form-stack">
            <input type="hidden" name="id" value={id} /><label>{t("order.evidence")}<textarea name="resolution" required minLength={10} maxLength={1000} /></label>
            <button className="button outline">{t("order.supportConfirmBtn")}</button>
          </form></details>}
          {order.settled_at && (seller || admin) && <p>{t("order.settledOn", { date: f.date(order.settled_at) })}{order.payout_ref && ` · ${order.payout_ref}`}</p>}
          {order.payment_ref && admin && <p>{t("pay.verifiedRef")}: {order.payment_ref}</p>}
        </div> : null}

        {((buyer || admin) && refundAllowed || admin && order.status === "refund_requested" || order.refund_ref && (buyer || admin)) && <div className="panel"><h2>{t("order.refunds")}</h2>
          {buyer && refundAllowed && <details><summary>{t("order.requestRefund")}</summary><form action={requestRefund} className="form-stack">
            <input type="hidden" name="id" value={id} /><label>{t("order.reason")}<textarea name="reason" required minLength={5} maxLength={500} /></label>
            {manual && <label>{t("order.refundAccount")}<input name="account" required maxLength={200} /></label>}
            <button className="button outline">{t("order.submitRequest")}</button></form></details>}
          {admin && refundAllowed && <details><summary>{t("order.openRefund")}</summary><form action={supportOpenRefund} className="form-stack">
            <input type="hidden" name="id" value={id} /><label>{t("order.reason")}<textarea name="reason" required minLength={5} maxLength={500} /></label>
            <button className="button outline">{t("order.openRefundBtn")}</button></form></details>}
          {admin && order.status === "refund_requested" && <><p className="wrap">{order.refund_reason}</p>
            {manual && order.refund_account && <p>{t("order.refundTo")}: <strong>{order.refund_account}</strong> · {money(total)}</p>}
            <form action={reviewRefund} className="form-stack"><input type="hidden" name="id" value={id} />
              {manual && <label>{t("order.refundRef")}<input name="reference" maxLength={120} /></label>}
              <div className="inline-form"><button className="button primary" name="decision" value="approve">{t("order.approveRefund")}</button><button className="button outline" name="decision" value="reject">{t("order.decline")}</button></div>
            </form></>}
          {order.refund_ref && <p>{t("order.refundRef")}: {order.refund_ref}</p>}
        </div>}

        {order.status === "confirmed" && (review ? <div className="panel review-box"><h2>{t("review.title")}</h2>
          <Stars value={review.rating} />{review.comment && <p className="wrap">{review.comment}</p>}</div> :
          buyer && <form action={submitReview} className="panel form-stack review-box">
            <h2>{t("review.title")}</h2><p>{t("review.lead", { seller: order.seller })}</p>
            <input type="hidden" name="id" value={id} />
            <fieldset className="star-input"><legend className="sr-only">{t("review.rating")}</legend>
              {[5, 4, 3, 2, 1].map((n) => <label key={n} title={`${n}`}><input type="radio" name="rating" value={n} required defaultChecked={n === 5} /><span aria-hidden="true">★</span><span className="sr-only">{n}</span></label>)}
            </fieldset>
            <label>{t("review.comment")}<textarea name="comment" maxLength={500} placeholder={t("review.placeholder")} /></label>
            <button className="button primary">{t("review.submit")}</button>
          </form>)}

        {admin && <div className="panel contacts">
          <p><UserRound size={16} /> {order.buyer_name} · {order.buyer_email}</p>
          <p><Ticket size={16} /> {order.seller}{order.seller_phone && <> · <a className="text-link" href={`https://wa.me/${order.seller_phone}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> +{order.seller_phone}</a></>}</p>
        </div>}
      </section>

      <aside className="panel summary">
        <h2>{seller && !admin ? t("order.sellerProceeds") : t("order.summary")}</h2>
        <dl><div><dt>{t("order.subtotal")}</dt><dd>{money(order.subtotal)}</dd></div>
          {(buyer || admin) && <div><dt>{t("order.buyerFee", { pct: percent(order.buyer_bps) })}</dt><dd>{money(order.buyer_fee)}</dd></div>}
          {(seller || admin) && <div><dt>{t("order.sellerFee", { pct: percent(order.seller_bps) })}</dt><dd>{money(order.seller_fee)}</dd></div>}
          {(seller || admin) && <div><dt>{t("order.sellerProceeds")}</dt><dd>{money(order.subtotal - order.seller_fee)}</dd></div>}
          {admin && <div><dt>{t("order.commission")}</dt><dd>{money(order.buyer_fee + order.seller_fee)}</dd></div>}
          {(buyer || admin) && <div className="summary-total"><dt>{t("order.total")}</dt><dd>{money(total)}</dd></div>}
          {admin && order.net_payment !== null && <div><dt>{t("order.net")}</dt><dd>{money(order.net_payment - order.subtotal + order.seller_fee)}</dd></div>}
        </dl>
        {awaitingPayment && buyer && !pendingStripe && !manual && <form action={payOrder} className="form-stack">
          <input type="hidden" name="id" value={id} /><button className="button primary"><LockKeyhole size={17} /> {order.payment_mode === "demo" ? t("order.simulate") : t("order.payStripe")}</button>
          <small>{order.payment_mode === "demo" ? t("order.demoNote") : t("order.stripeNote")}</small>
        </form>}
        {pendingStripe && <Link className="button outline" href={`/orders/${id}`}>{t("order.return")}</Link>}
        {awaitingPayment && buyer && !pendingStripe && <form action={cancelOrder}>
          <input type="hidden" name="id" value={id} /><button className="button ghost">{t("order.cancel")}</button>
        </form>}
        {(expired || order.status === "cancelled") && buyer && <Link className="button outline" href={`/events/${order.slug}`}>{t("order.returnEvent")}</Link>}
        {admin && order.status === "confirmed" && !order.settled_at && <form action={settleOrder} className="form-stack"><input type="hidden" name="id" value={id} />
          {manual && (order.payout_account ? <p className="payout-to">{t("order.payTo")}: <strong>{order.payout_bank} · {order.payout_name} · {order.payout_account}</strong></p> : <p>{t("order.payoutMissing")}</p>)}
          {manual && <label>{t("order.payoutRef")}<input name="reference" maxLength={120} required disabled={!afterEvent} /></label>}
          <button className="button primary" disabled={!afterEvent}>{t("order.settle")}</button>
          <small>{t("order.settleHint")}</small></form>}
        {buyer && <SupportLinks t={t} order={id} />}
      </aside>
    </div>
  </div>;
}
