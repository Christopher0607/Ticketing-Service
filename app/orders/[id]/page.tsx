import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, LockKeyhole, MapPin, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { date, money, percent, uuid } from "@/lib/format";
import { orderById } from "@/lib/orders";
import { cancelOrder, confirmReceipt, deliverOrder, payOrder, requestRefund, reviewRefund, settleOrder, supportConfirmDelivery, supportOpenRefund } from "../../actions";
import { PaymentRefresh } from "./payment-refresh";
import { Notice, Status, SupportLink } from "../../ui";

export const metadata = { title: "Order details" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string; payment?: string }> }) {
  const [{ id }, notice] = await Promise.all([params, searchParams]);
  if (!uuid.test(id)) notFound();
  const user = await requireUser(`/orders/${id}`);
  const order = await orderById(id);
  if (!order) notFound();
  const buyer = order.buyer_id === user.id;
  const seller = order.seller_id === user.id;
  const admin = user.role === "admin";
  if (!buyer && !seller && !admin) notFound();
  if (seller && ["reserved", "expired", "cancelled"].includes(order.status)) notFound();
  const deadline = order.expires_at.getTime() - (order.payment_mode === "stripe" && !order.checkout_attempted ? 1800000 : 0);
  const expired = order.status === "expired" || (order.status === "reserved" && deadline <= Date.now());
  const canViewTransfer = (buyer || admin) && !!order.transfer_ref && ["delivered","confirmed"].includes(order.status);
  const afterEvent = order.starts_at.getTime() + 86400000 <= Date.now();
  const pendingStripe = buyer && notice.payment === "returned" && !expired && order.payment_mode === "stripe" && order.status === "reserved";
  const refundAllowed = ["paid","delivered","confirmed"].includes(order.status) && !order.settled_at;
  return <div className="shell page">
    <Link className="back-link" href={admin ? "/admin" : seller ? "/sell" : "/account"}><ChevronLeft size={18} /> {admin ? "Administration" : seller ? "Seller dashboard" : "My orders"}</Link>
    <div className="page-heading heading-split"><div><h1>{order.status === "reserved" && buyer && !expired ? "Checkout" : "Order details"}</h1><p>Order {order.id.slice(0, 8).toUpperCase()}</p></div>
      <Status value={expired ? "expired" : order.status} /></div>
    <Notice {...notice} />
    <div className="detail-grid">
      <section className="row-list">
        <div className="panel order-event"><div className={`order-image image-${order.image}`}><img src={`/images/${order.image}.webp`} alt="" /></div>
          <div><h2>{order.title}</h2><p><CalendarDays size={17} /> {date(order.starts_at)}</p><p><MapPin size={17} /> {order.venue}</p><p><Ticket size={17} /> {order.quantity} × {order.section}</p></div>
        </div>
        <div className="panel about-event"><h2>Ticket transfer</h2>
          {pendingStripe && <PaymentRefresh />}
          {order.status === "reserved" ? <p>{expired ? "Your reservation has expired. Check the event for current availability." : "Your tickets are held while you complete payment."}</p> :
            order.status === "paid" ? <p>{seller ? "Send the official transfer before recording it below." : "The seller will transfer your tickets through the original ticket provider."}</p> : null}
          {buyer && order.status === "paid" && <p>Transfer email <strong>{order.buyer_email}</strong></p>}
          {seller && order.status === "paid" && <form className="form-stack" action={deliverOrder}>
            <input type="hidden" name="id" value={id} /><p>Send to <strong>{order.buyer_email}</strong></p>
            <label>Transfer reference<input name="reference" minLength={2} maxLength={180} required /></label>
            <label>Official transfer link (optional)<input name="link" type="url" placeholder={order.transfer_host ? `https://${order.transfer_host}/…` : undefined} maxLength={1500} /></label>
            <button className="button primary">Record transfer</button>
          </form>}
          {canViewTransfer && <p>Transfer reference <strong>{order.transfer_ref}</strong></p>}
          {canViewTransfer && order.transfer_url && <p><a className="text-link" href={order.transfer_url} target="_blank" rel="noreferrer">Open official ticket transfer</a></p>}
          {order.status === "delivered" && buyer && <form action={confirmReceipt}>
            <p>Confirm after you’ve accepted and checked your ticket with the original provider.</p>
            <input type="hidden" name="id" value={id} /><button className="button primary">Confirm ticket received</button>
          </form>}
          {order.status === "confirmed" && <p>{order.support_confirmed_at ? "Ticket transfer confirmed by support." : "Ticket receipt confirmed."}</p>}
          {admin && order.support_resolution && <p className="wrap">{order.support_resolution}</p>}
          {admin && order.status === "delivered" && afterEvent && <details><summary>Confirm delivery from evidence</summary><form action={supportConfirmDelivery} className="form-stack">
            <input type="hidden" name="id" value={id} /><label>Evidence and resolution<textarea name="resolution" required minLength={10} maxLength={1000} /></label>
            <button className="button outline">Confirm seller delivery</button>
          </form></details>}
          {order.settled_at && (seller || admin) && <p>Settlement recorded on {date(order.settled_at)}.</p>}
          {["refunded","refund_pending","refund_requested","disputed","expired","cancelled"].includes(order.status) && <p><Status value={order.status} /></p>}
        </div>
        {((buyer || admin) && refundAllowed || admin && order.status === "refund_requested") && <div className="panel about-event"><h2>Refunds</h2>
          {buyer && <details><summary>Request a refund</summary><form action={requestRefund} className="form-stack">
            <input type="hidden" name="id" value={id} /><label>Reason<textarea name="reason" required minLength={5} maxLength={500} /></label><button className="button outline">Submit request</button></form></details>}
          {admin && refundAllowed && <details><summary>Open a refund</summary><form action={supportOpenRefund} className="form-stack">
            <input type="hidden" name="id" value={id} /><label>Reason<textarea name="reason" required minLength={5} maxLength={500} /></label>
            <button className="button outline">Open refund for review</button></form></details>}
          {admin && order.status === "refund_requested" && <><p>{order.refund_reason}</p><form action={reviewRefund} className="inline-form"><input type="hidden" name="id" value={id} />
            <button className="button primary" name="decision" value="approve">Approve refund</button><button className="button outline" name="decision" value="reject">Decline</button></form></>}
        </div>}
      </section>
      <aside className="panel about-event summary">
        <h2>{seller ? "Seller proceeds" : "Order summary"}</h2>
        <dl><div><dt>Ticket subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          {(buyer || admin) && <div><dt>Buyer service fee ({percent(order.buyer_bps)})</dt><dd>{money(order.buyer_fee)}</dd></div>}
          {(seller || admin) && <div><dt>Seller service fee ({percent(order.seller_bps)})</dt><dd>{money(order.seller_fee)}</dd></div>}
          {(seller || admin) && <div><dt>Seller proceeds</dt><dd>{money(order.subtotal - order.seller_fee)}</dd></div>}
          {(buyer || admin) && <div className="summary-total"><dt>Total</dt><dd>{money(order.subtotal + order.buyer_fee)}</dd></div>}
          {admin && order.net_payment !== null && <div><dt>After processor fees and seller proceeds</dt><dd>{money(order.net_payment - order.subtotal + order.seller_fee)}</dd></div>}
        </dl>
        {order.status === "reserved" && !expired && buyer && !pendingStripe && <form action={payOrder} className="form-stack">
          <input type="hidden" name="id" value={id} /><button className="button primary"><LockKeyhole size={17} /> {order.payment_mode === "demo" ? "Simulate payment" : "Pay with Stripe"}</button>
          <small>{order.payment_mode === "demo" ? "Local demo. No funds will move." : "Payment details are collected securely by Stripe."}</small>
        </form>}
        {pendingStripe && <Link className="button outline" href={`/orders/${id}`}>Return to order</Link>}
        {order.status === "reserved" && !expired && buyer && !pendingStripe && <form action={cancelOrder}>
          <input type="hidden" name="id" value={id} /><button className="button outline">Cancel reservation</button>
        </form>}
        {(expired || order.status === "cancelled") && buyer && <Link className="button outline" href={`/events/${order.slug}`}>Return to event</Link>}
        {admin && order.status === "confirmed" && !order.settled_at && <form action={settleOrder} className="form-stack"><input type="hidden" name="id" value={id} />
          <button className="button primary" disabled={!afterEvent}>Settle seller proceeds</button>
          <small>Available 24 hours after the event starts.</small></form>}
        {buyer && <SupportLink order={id} />}
      </aside>
    </div>
  </div>;
}
