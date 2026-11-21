import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import { events, fees } from "@/lib/market";
import { date } from "@/lib/format";
import { CategoryNav, Empty, EventCard, SearchBar, TrustStrip } from "./ui";

export default async function Home() {
  const [catalogue, settings] = await Promise.all([events(), fees()]);
  const featured = catalogue.find((item) => item.featured && item.tickets > 0);
  const upcoming = catalogue.filter((item) => item.id !== featured?.id).slice(0, 3);
  return <>
    <section className="hero">
      <div className="hero-art" aria-hidden="true"><img src="/images/hero.webp" alt="" /></div>
      <div className="shell hero-inner">
        <div className="hero-content">
          <p className="hero-kicker"><span /> Malaysia’s ticket marketplace</p>
          <h1>Good nights <br />start <em>here.</em></h1>
          <p className="hero-description">Find your next concert, festival or game. Buy and sell live event tickets across Malaysia.</p>
          <SearchBar hero />
        </div>
        {featured && <Link href={`/events/${featured.slug}`} className="featured-panel">
          <div><span className="featured-label"><Ticket size={15} /> Featured event</span><h2>{featured.title}</h2>
            <span className="featured-meta"><CalendarDays size={15} /> {date(featured.starts_at, { day: "numeric", month: "short" })} <MapPin size={15} /> {featured.venue}</span>
          </div><span className="featured-icon" aria-hidden="true"><ArrowUpRight size={23} /></span>
        </Link>}
      </div>
    </section>
    <section className="shell discovery" aria-labelledby="upcoming">
      <CategoryNav />
      <div className="section-header"><div><h2 id="upcoming">Upcoming events</h2><p>Find something worth going out for.</p></div>
        <Link href="/events" className="button outline">View all events</Link></div>
      {upcoming.length ? <div className="event-grid">{upcoming.map((item) => <EventCard key={item.id} item={item} bps={settings.buyer_bps} />)}</div> :
        <Empty title="New events are on the way." />}
    </section>
    <TrustStrip />
  </>;
}
