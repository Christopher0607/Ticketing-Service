import Link from "next/link";
import { ChevronRight, CircleDollarSign, ListPlus, Ticket } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { paymentMode } from "@/lib/config";
import { query } from "@/lib/db";
import { date, fee, money, percent } from "@/lib/format";
import { events, fees } from "@/lib/market";
import { recentOrders } from "@/lib/orders";
import { createListing, onboarding, pauseListing, refreshPayouts, requestSelling } from "../actions";
import { Empty, Notice, Status } from "../ui";

export const metadata = { title: "Sell tickets" };

export default async function Seller({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; connect?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams]);
  if (user?.role !== "seller") {
    const [application] = user?.role === "buyer" ? await query<{ seller_requested: boolean }>("SELECT seller_requested FROM users WHERE id=$1", [user.id]) : [];
    return <div className="shell page sell-landing">
      <div className="page-heading"><span className="empty-icon"><Ticket size={24} /></span><h1>Sell tickets on Setlist</h1><p>List tickets for approved events and track transfers and settlement from your dashboard.</p></div>
      <div className="feature-grid">
        <div className="panel"><ListPlus size={26} /><h2>Set your price</h2><p>Choose your event, section, quantity and price. We review your listing before publication.</p></div>
        <div className="panel"><Ticket size={26} /><h2>Transfer the ticket</h2><p>Use the original ticket provider to transfer the ticket to the buyer after checkout.</p></div>
        <div className="panel"><CircleDollarSign size={26} /><h2>Track settlement</h2><p>See the commission and expected proceeds on each order.</p></div>
      </div>
      {user?.role === "admin" ? <Link className="button primary" href="/admin">Admin dashboard</Link> : application?.seller_requested ?
        <Link className="button primary" href="/account">View application</Link> : user ?
        <form action={requestSelling}><button className="button primary">Apply to sell</button></form> :
        <Link className="button primary" href="/account?next=%2Fsell">Sign in to apply</Link>}
    </div>;
  }
  const [listings, catalogue, orders, settings] = await Promise.all([
    query<{ id: string; title: string; section: string; price: number; available: number; quantity: number; status: string; paused_by_admin: boolean }>(`
      SELECT l.*,e.title FROM listings l JOIN events e ON e.id=l.event_id WHERE seller_id=$1 ORDER BY l.created_at DESC LIMIT 100`, [user.id]),
    events(), recentOrders(user.id, "seller"), fees(),
  ]);
  return <div className="shell page">
    <div className="page-heading"><h1>Seller dashboard</h1><p>Manage your listings, ticket transfers and seller proceeds.</p></div>
    <Notice error={params.error} success={params.success} />
    {paymentMode() === "stripe" && <section className="panel stripe-panel"><div><h2>Stripe payouts</h2>
      <p>{user.stripe_ready ? "Your account can receive payouts." : params.connect ? "Check your onboarding status with Stripe." : "Complete Stripe onboarding so you can receive proceeds."}</p></div>
      <div className="inline-form"><form action={onboarding}><button className="button outline">Open Stripe onboarding</button></form>
      {user.stripe_account && <form action={refreshPayouts}><button className="button outline">Check status</button></form>}</div></section>}
    <div className="detail-grid dashboard-grid">
      <section><div className="section-header compact"><div><h2>Your listings</h2></div></div>
        {listings.length ? <div className="row-list">{listings.map((listing) => <article className="panel dashboard-row" key={listing.id}>
          <span className="row-icon"><Ticket size={21} /></span><div><strong>{listing.title}</strong><p>{listing.section} · {listing.available}/{listing.quantity} available</p><p>{money(listing.price - fee(listing.price, settings.seller_bps))} estimated per ticket</p></div>
          <Status value={listing.status} />
          {["active","paused"].includes(listing.status) && !listing.paused_by_admin && <form action={pauseListing}>
            <input type="hidden" name="id" value={listing.id} /><input type="hidden" name="decision" value={listing.status === "active" ? "paused" : "active"} />
            <button className="button outline small">{listing.status === "active" ? "Pause" : "Resume"}</button>
          </form>}
        </article>)}</div> : <Empty title="No listings yet" />}
        <div className="section-header compact"><div><h2>Ticket sales</h2></div></div>
        {orders.length ? <div className="row-list">{orders.map((order) => <Link className="panel dashboard-row" href={`/orders/${order.id}`} key={order.id}>
          <div><strong>{order.title}</strong><p>{order.quantity} ticket(s) · {money(order.subtotal - order.seller_fee)} proceeds</p></div>
          <Status value={order.status} /><ChevronRight size={18} /></Link>)}</div> : <Empty title="No ticket sales yet" />}
      </section>
      <aside className="panel about-event">
        <h2>List tickets</h2><p>Seller service fee is {percent(settings.seller_bps)} of your listed price.</p>
        {catalogue.length ? <form className="form-stack" action={createListing}>
          <label>Event<select name="event" aria-label="Event" required defaultValue=""><option value="" disabled>Choose an event</option>{catalogue.map((item) => <option key={item.id} value={item.id}>{item.title} · {date(item.starts_at)}</option>)}</select></label>
          <label>Seat or ticket section<input name="section" required minLength={2} maxLength={80} placeholder="e.g. Lower bowl, Section 102" /></label>
          <div className="form-columns"><label>Price per ticket (RM)<input name="price" type="number" min={2} max={25000} step=".01" required /></label>
            <label>Quantity<input name="quantity" type="number" min={1} max={100} required defaultValue={1} /></label></div>
          <label>Proof of ticket ownership<textarea name="proof" required minLength={5} maxLength={1000} placeholder="Original provider and order reference" /></label>
          <label>Redacted proof file (optional)<input name="attachment" type="file" accept="application/pdf,image/png,image/jpeg" /></label>
          <small>PDF, PNG or JPG, up to 2 MB. Remove barcodes, QR codes and personal details before uploading.</small>
          <button className="button primary">Submit for review</button>
        </form> : <p>There are no events open for listing.</p>}
      </aside>
    </div>
  </div>;
}
