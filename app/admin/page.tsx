import Link from "next/link";
import { ChevronRight, ClipboardList, Percent, Ticket, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { categories, date, money } from "@/lib/format";
import { fees } from "@/lib/market";
import { recentOrders } from "@/lib/orders";
import { approveSeller, closeEvent, createEvent, reviewListing, updateFees } from "../actions";
import { Notice, Status } from "../ui";

export const metadata = { title: "Administration" };

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await requireUser("/admin", "admin");
  const [params, applications, listings, catalogue, orders, settings] = await Promise.all([
    searchParams,
    query<{ id: string; name: string; email: string }>("SELECT id,name,email FROM users WHERE seller_requested AND role='buyer' ORDER BY created_at LIMIT 100"),
    query<{ id: string; title: string; name: string; section: string; price: number; quantity: number; status: string; proof: string; proof_type: string | null }>(`
      SELECT l.id,l.section,l.price,l.quantity,l.status,l.proof,l.proof_type,e.title,u.name FROM listings l JOIN events e ON e.id=l.event_id JOIN users u ON u.id=l.seller_id
      WHERE l.status IN ('pending','active','paused') ORDER BY (l.status='pending') DESC,l.created_at DESC LIMIT 100`),
    query<{ id: string; slug: string; title: string; starts_at: Date; active: boolean }>("SELECT id,slug,title,starts_at,active FROM events ORDER BY starts_at DESC LIMIT 100"),
    recentOrders(user.id, "admin"),
    fees(),
  ]);
  return <div className="shell page">
    <div className="page-heading"><h1>Administration</h1><p>Review sellers and listings, manage events and settle orders.</p></div>
    <Notice error={params.error} success={params.success} />
    <div className="admin-grid">
      <div className="row-list">
        <section className="panel admin-panel"><h2><Users size={21} /> Seller applications</h2>
          {!applications.length && <p>No applications to review.</p>}
          {applications.map((application) => <div className="admin-row" key={application.id}><div><strong>{application.name}</strong><p>{application.email}</p></div>
            <form action={approveSeller}><input type="hidden" name="id" value={application.id} /><button className="button outline small">Approve seller</button></form></div>)}
        </section>
        <section className="panel admin-panel"><h2><Ticket size={21} /> Listing review</h2>
          {!listings.length && <p>No listings to review.</p>}
          {listings.map((listing) => <div className="admin-listing" key={listing.id}><div className="admin-row"><div><strong>{listing.title} · {listing.section}</strong>
            <p>{listing.name} · {listing.quantity} tickets · {money(listing.price)} each</p></div><Status value={listing.status} /></div>
            <details><summary>View ownership proof</summary><p className="wrap">{listing.proof}</p>{listing.proof_type && <a className="text-link" href={`/api/admin/listings/${listing.id}/proof`}>Download proof file</a>}</details>
            <form className="inline-form" action={reviewListing}><input type="hidden" name="id" value={listing.id} />
              {listing.status !== "active" && <button className="button outline small" name="decision" value="active">{listing.status === "pending" ? "Approve listing" : "Resume listing"}</button>}
              {listing.status === "pending" && <button className="button outline small" name="decision" value="rejected">Decline listing</button>}
              {listing.status === "active" && <button className="button outline small" name="decision" value="paused">Pause listing</button>}
            </form></div>)}
        </section>
        <section className="panel admin-panel"><h2><ClipboardList size={21} /> Orders</h2>
          {!orders.length && <p>No orders yet.</p>}
          {orders.map((order) => <Link className="admin-row admin-order" href={`/orders/${order.id}`} key={order.id}>
            <div><strong>{order.title}</strong><p>{order.id.slice(0, 8).toUpperCase()} · {money(order.subtotal + order.buyer_fee)}</p></div>
            <Status value={order.settled_at && order.status !== "disputed" ? "Settled" : order.status} /><ChevronRight size={17} /></Link>)}
        </section>
      </div>
      <div className="row-list">
        <section className="panel admin-panel"><h2><Percent size={21} /> Commission rates</h2><p>Changes apply to new orders.</p>
          <form action={updateFees} className="form-stack"><div className="form-columns"><label>Buyer fee (%)<input name="buyer fee" type="number" min={0} max={30} step=".01" required defaultValue={settings.buyer_bps / 100} /></label>
            <label>Seller fee (%)<input name="seller fee" type="number" min={0} max={30} step=".01" required defaultValue={settings.seller_bps / 100} /></label></div>
          <button className="button primary">Save rates</button></form>
        </section>
        <section className="panel admin-panel"><h2>Publish an event</h2><p>Confirm that the original provider allows ticket resale and transfer.</p>
          <form action={createEvent} className="form-stack">
            <label>Event name<input name="title" required minLength={3} maxLength={100} /></label>
            <label>Category<select name="category">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <div className="form-columns"><label>Venue<input name="venue" required maxLength={100} /></label><label>City<input name="city" required maxLength={80} /></label></div>
            <label>Start (Malaysia time)<input type="datetime-local" name="start" required /></label>
            <label>Description<textarea name="description" required minLength={10} maxLength={1500} /></label>
            <label>Official resale policy URL<input name="policy" type="url" required maxLength={1500} /></label>
            <label>Official transfer site<input name="transfer site" type="url" required maxLength={1500} /></label>
            <label className="check-label"><input type="checkbox" name="featured" /> Feature on the homepage</label>
            <button className="button primary">Publish event</button>
          </form>
        </section>
        <section className="panel admin-panel"><h2>Event catalogue</h2>
          {!catalogue.length && <p>No events published yet.</p>}
          {catalogue.map((item) => <div className="admin-row" key={item.id}><div>
            {item.active ? <Link className="text-link" href={`/events/${item.slug}`}>{item.title}</Link> : <strong>{item.title}</strong>}
            <p>{date(item.starts_at)}</p></div><form action={closeEvent}>
              <input type="hidden" name="id" value={item.id} /><input type="hidden" name="active" value={String(!item.active)} />
              <button className="button outline small">{item.active ? "Hide event" : "Show event"}</button></form></div>)}
        </section>
      </div>
    </div>
  </div>;
}
