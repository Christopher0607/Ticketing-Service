import Link from "next/link";
import { CircleHelp, CreditCard, ShieldCheck, Ticket } from "lucide-react";

import { SupportLink } from "../ui";

export const metadata = { title: "How it works" };

export default function Help() {
  return <div className="shell page sell-landing">
    <div className="page-heading"><span className="empty-icon"><CircleHelp size={25} /></span><h1>How Setlist works</h1><p>From finding an event to receiving your tickets.</p></div>
    <div className="feature-grid">
      <div className="panel"><Ticket size={27} /><h2>Choose your tickets</h2><p>Pick an event and compare listings. Prices on listing pages include the buyer service fee.</p></div>
      <div className="panel"><CreditCard size={27} /><h2>Pay for your order</h2><p>See the ticket subtotal and service fee before paying. View the payment status in My orders.</p></div>
      <div className="panel"><ShieldCheck size={27} /><h2>Accept the transfer</h2><p>The seller transfers through the original ticket provider. Check your inbox and order page, then confirm receipt.</p></div>
    </div>
    <section className="panel about-event faq"><h2>Ticket and payment questions</h2>
      <details><summary>Where do I find my tickets?</summary><p>Open your order to see the transfer status and any official link provided by the seller. The original ticket provider may email you to accept the ticket.</p></details>
      <details><summary>What if I haven’t received the ticket?</summary><p>Check your spam folder and open the order page. Use the refund request on the order if the seller hasn’t delivered or you can’t access the ticket.</p></details>
      <details><summary>Who sets the ticket price?</summary><p>The seller sets the listing price. Setlist adds the buyer service fee and deducts a seller service fee from the seller’s proceeds.</p></details>
      <details><summary>Can I list tickets I bought elsewhere?</summary><p>Apply for seller access and submit your proof of ownership for review. List tickets only where the original provider permits resale and transfer.</p></details>
    </section>
    <div className="inline-form"><Link href="/events" className="button primary">Explore events</Link><Link className="button outline" href="/account">Open my orders</Link><SupportLink /></div>
  </div>;
}
