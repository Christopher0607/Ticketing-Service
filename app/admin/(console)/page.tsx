import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Landmark, ListChecks, MessageCircle, ReceiptText, Ticket, Undo2, Users, Wallet } from "lucide-react";
import { query } from "@/lib/db";
import { money } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { recentOrders } from "@/lib/orders";
import { OrderRows } from "@/app/admin/parts";
import { approveSeller } from "@/app/actions";
import { Notice } from "@/app/ui";

export const metadata = { title: "Admin" };

export default async function Overview({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [params, { t }] = await Promise.all([searchParams, i18n()]);
  const [[stats], applications, verifying, refunds, confirmed] = await Promise.all([
    query<{ gmv: number; commission: number; listings: number; pending_listings: number; month: number; users: number }>(`SELECT
      (SELECT coalesce(sum(subtotal+buyer_fee),0)::int FROM orders WHERE status IN ('paid','delivered','confirmed')) AS gmv,
      (SELECT coalesce(sum(buyer_fee+seller_fee),0)::int FROM orders WHERE status IN ('paid','delivered','confirmed')) AS commission,
      (SELECT coalesce(sum(buyer_fee+seller_fee),0)::int FROM orders WHERE status IN ('paid','delivered','confirmed')
        AND paid_at>=date_trunc('month', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur') AS month,
      (SELECT count(*)::int FROM listings WHERE status='active' AND available>0) AS listings,
      (SELECT count(*)::int FROM listings WHERE status='pending') AS pending_listings,
      (SELECT count(*)::int FROM users) AS users`),
    query<{ id: string; name: string; email: string; phone: string | null }>("SELECT id,name,email,phone FROM users WHERE seller_requested AND role='buyer' ORDER BY created_at LIMIT 20"),
    recentOrders("", "admin", ["verifying"]),
    recentOrders("", "admin", ["refund_requested"]),
    recentOrders("", "admin", ["confirmed"]),
  ]);
  const toSettle = confirmed.filter((order) => !order.settled_at && order.starts_at.getTime() + 86400000 <= Date.now());
  const pending = verifying.length + refunds.length + toSettle.length + applications.length + stats.pending_listings;
  return <>
    <div className="page-heading"><h1>{t("console.nav.overview")}</h1><p>{t("admin.lead")}</p></div>
    <Notice t={t} error={params.error} success={params.success} />
    <div className="stat-grid">
      <div className="stat"><BadgeDollarSign size={20} /><span>{t("admin.stat.gmv")}</span><strong>{money(stats.gmv)}</strong></div>
      <div className="stat gold"><Wallet size={20} /><span>{t("admin.stat.commission")}</span><strong>{money(stats.commission)}</strong><small>{t("console.thisMonth", { amount: money(stats.month) })}</small></div>
      <div className="stat"><ListChecks size={20} /><span>{t("admin.stat.pending")}</span><strong>{pending}</strong></div>
      <div className="stat"><Ticket size={20} /><span>{t("admin.stat.listings")}</span><strong>{stats.listings}</strong><small>{t("console.users", { count: stats.users })}</small></div>
    </div>
    <div className="admin-grid">
      <div className="row-list">
        <section className="panel admin-panel"><h2><ReceiptText size={20} /> {t("admin.payments")} {verifying.length > 0 && <span className="tab-count">{verifying.length}</span>}</h2>
          <OrderRows t={t} orders={verifying} empty={t("admin.noPayments")} /></section>
        {refunds.length > 0 && <section className="panel admin-panel"><h2><Undo2 size={20} /> {t("admin.refunds")} <span className="tab-count">{refunds.length}</span></h2>
          <OrderRows t={t} orders={refunds} empty="" /></section>}
        <section className="panel admin-panel"><h2><Landmark size={20} /> {t("admin.toSettle")}</h2>
          <OrderRows t={t} orders={toSettle} empty={t("admin.noSettle")} /></section>
      </div>
      <div className="row-list">
        <section className="panel admin-panel"><h2><Ticket size={20} /> {t("admin.listings")}</h2>
          <p className="muted">{stats.pending_listings ? t("console.pendingListings", { count: stats.pending_listings }) : t("admin.noListings")}</p>
          <Link className="button outline small" href="/admin/listings">{t("console.openListings")} <ArrowRight size={14} /></Link></section>
        <section className="panel admin-panel"><h2><Users size={20} /> {t("admin.applications")}</h2>
          {!applications.length && <p className="muted">{t("admin.noApplications")}</p>}
          {applications.map((application) => <div className="admin-row" key={application.id}><div><strong>{application.name}</strong><p>{application.email}</p>
            {application.phone && <a className="text-link" href={`https://wa.me/${application.phone}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> +{application.phone}</a>}</div>
            <form action={approveSeller}><input type="hidden" name="id" value={application.id} /><input type="hidden" name="back" value="/admin" />
              <button className="button outline small">{t("admin.approveSeller")}</button></form></div>)}
        </section>
      </div>
    </div>
  </>;
}
