import { CalendarDays, ChevronLeft, Clock3, MapPin, ShieldCheck, Ticket } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { date, money, time } from "@/lib/format";
import { paymentMode } from "@/lib/config";
import { event, eventListings, priceWithFee } from "@/lib/market";
import { startCheckout } from "../../actions";
import { Empty, Notice } from "../../ui";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> };
export async function generateMetadata({ params }: Params) {
  const item = await event((await params).slug);
  return { title: item?.title ?? "Event" };
}
export default async function Detail({ params, searchParams }: Params) {
  const [item, { error }] = await Promise.all([params.then(({ slug }) => event(slug)), searchParams]);
  if (!item) notFound();
  const available = item.starts_at.getTime() > Date.now() + 2700000;
  const listings = available ? await eventListings(item.id) : [];
  return <div className="shell page">
    <Link className="back-link" href="/events"><ChevronLeft size={18} /> Explore events</Link>
    <section className="detail-hero" style={{ backgroundImage: `linear-gradient(90deg,#151225 7%,#151225ed 34%,#15122540 100%),url(/images/${item.image}.webp)` }}>
      <span className="event-category">{item.category}</span><h1>{item.title}</h1>
      <div className="detail-meta"><span><CalendarDays size={19} /> {date(item.starts_at)}</span><span><Clock3 size={19} /> {time(item.starts_at)} MYT</span><span><MapPin size={19} /> {item.venue}, {item.city}</span></div>
    </section>
    <div className="detail-grid">
      <section><div className="section-header compact"><div><h2>Available tickets</h2><p>Prices shown include the buyer service fee.</p></div></div>
        <Notice error={error ?? (listings.length && !paymentMode() ? "Checkout is temporarily unavailable." : undefined)} />
        {!listings.length ? <Empty title={available ? "No tickets available" : "Sales have closed"}><Link href="/events">Explore other events</Link></Empty> :
          listings.map((listing) => <article key={listing.id} className="panel listing"><div><Ticket size={20} /><h3>{listing.section}</h3><p>{listing.seller} · {listing.available} available</p></div>
            <form action={startCheckout}>
              <input type="hidden" name="id" value={listing.id} /><input type="hidden" name="slug" value={item.slug} />
              <strong>{money(priceWithFee(listing.price, listing.buyer_bps))} <small>per ticket</small></strong>
              <label><span className="sr-only">Quantity for {listing.section}</span><select name="quantity">{Array.from({ length: Math.min(10, listing.available) }, (_, i) => <option key={i}>{i + 1}</option>)}</select></label>
              <button className="button primary" disabled={!paymentMode()}>Select tickets</button>
            </form>
          </article>)}
      </section>
      <aside className="panel about-event"><h2>About this event</h2><p>{item.description}</p>
        <hr /><h3><ShieldCheck size={19} /> Ticket transfer</h3><p>The seller transfers your tickets through the original ticket provider after payment.</p>
        {item.transfer_policy_url && <a className="text-link" href={item.transfer_policy_url} target="_blank" rel="noreferrer">Read the event’s transfer policy</a>}
      </aside>
    </div>
  </div>;
}
