import Link from "next/link";
import { ChevronRight, KeyRound, Ticket, UserRound } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { mailConfigured } from "@/lib/identity";
import { query } from "@/lib/db";
import { date, money } from "@/lib/format";
import { recentOrders } from "@/lib/orders";
import { resendVerification, requestSelling, signIn, signOut, signUp } from "../actions";
import { Empty, Notice, Status } from "../ui";

export const metadata = { title: "My account" };

export default async function Account({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string; error?: string; success?: string; notice?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams]);
  const next = typeof params.next === "string" ? params.next : "/account";
  if (!user) {
    const register = params.mode === "register";
    return <div className="shell page auth-page"><section className="panel auth-card">
      <span className="empty-icon">{register ? <UserRound size={24} /> : <KeyRound size={24} />}</span>
      <h1>{register ? "Create your account" : "Welcome back"}</h1>
      <p>{register ? "Use the email where you want to receive official ticket transfers." : "Sign in to manage your tickets and orders."}</p>
      <Notice error={params.error} success={params.success} />
      <form className="form-stack" action={register ? signUp : signIn}>
        <input type="hidden" name="next" value={next} />
        {register && <label>Your name<input required name="name" autoComplete="name" maxLength={80} /></label>}
        <label>Email address<input required name="email" type="email" autoComplete="email" maxLength={254} /></label>
        <label>Password<input required name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 12 : undefined} maxLength={128} /></label>
        {register && <small>Use at least 12 characters.</small>}
        <button className="button primary">{register ? "Create account" : "Sign in"}</button>
      </form>
      {!register && mailConfigured() && <p><Link className="text-link" href="/account/recover">Forgot password?</Link></p>}
      <p>{register ? "Already have an account? " : "New to Setlist? "}<Link className="text-link" href={`/account?${new URLSearchParams({ mode: register ? "login" : "register", next })}`}>{register ? "Sign in" : "Create an account"}</Link></p>
    </section></div>;
  }
  const [orders, [application]] = await Promise.all([
    recentOrders(user.id, "buyer"),
    query<{ seller_requested: boolean }>("SELECT seller_requested FROM users WHERE id=$1", [user.id]),
  ]);
  return <div className="shell page">
    <div className="page-heading heading-split"><div><h1>My account</h1><p>{user.name} · {user.email}</p></div><form action={signOut}><button className="button outline">Sign out</button></form></div>
    <Notice error={params.error} success={params.success} />
    {!user.email_verified && <section className="panel stripe-panel"><div><h2>Verify your email</h2><p>Verify the email where you’ll receive ticket transfers before buying or selling.</p></div>
      <form action={resendVerification}><button className="button outline">Send verification link</button></form></section>}
    <div className="detail-grid">
      <section><div className="section-header compact"><div><h2>My orders</h2></div></div>
        {orders.length ? <div className="row-list">{orders.map((order) => <Link className="panel dashboard-row" key={order.id} href={`/orders/${order.id}`}>
          <span className="row-icon"><Ticket size={21} /></span><div><strong>{order.title}</strong><p>{date(order.starts_at)} · {order.quantity} {order.quantity === 1 ? "ticket" : "tickets"}</p></div>
          <Status value={order.status} /><strong className="row-total">{money(order.subtotal + order.buyer_fee)}</strong><ChevronRight size={18} />
        </Link>)}</div> : <Empty title="You have no orders yet"><Link className="button primary" href="/events">Explore events</Link></Empty>}
      </section>
      <aside className="panel about-event"><h2>Sell tickets</h2>
        {user.role === "admin" ? <Link className="button outline" href="/admin">Open administration</Link> :
          user.role === "seller" ? <Link className="button outline" href="/sell">Open seller dashboard</Link> :
          application?.seller_requested ? <p>Your seller application is under review.</p> : <>
            <p>{params.notice === "seller-access" ? "Apply for seller access to start listing tickets." : "Apply for a seller account to list tickets you hold."}</p>
            <form action={requestSelling}><button className="button outline">Apply to sell</button></form>
          </>}
      </aside>
    </div>
  </div>;
}
