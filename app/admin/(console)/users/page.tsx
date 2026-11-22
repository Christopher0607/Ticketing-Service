import { Ban, KeyRound, MessageCircle, Search, UserCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { i18n } from "@/lib/i18n";
import { adminSetPassword, approveSeller, setBan } from "@/app/actions";
import { Notice } from "@/app/ui";

export const metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; success?: string }> }) {
  const [admin, params, { t, f }] = await Promise.all([requireAdmin("/admin/users"), searchParams, i18n()]);
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const [applications, users] = await Promise.all([
    query<{ id: string; name: string; email: string; phone: string | null; created_at: Date }>(
      "SELECT id,name,email,phone,created_at FROM users WHERE seller_requested AND role='buyer' ORDER BY created_at LIMIT 100"),
    query<{ id: string; name: string; email: string; role: "buyer" | "seller" | "admin"; phone: string | null; created_at: Date; banned_at: Date | null; orders: number; listings: number }>(`
      SELECT u.id,u.name,u.email,u.role,u.phone,u.created_at,u.banned_at,
        (SELECT count(*)::int FROM orders o WHERE o.buyer_id=u.id) AS orders,
        (SELECT count(*)::int FROM listings l WHERE l.seller_id=u.id) AS listings
      FROM users u WHERE ($1='' OR strpos(lower(u.email||' '||u.name||' '||coalesce(u.phone,'')),lower($1))>0)
      ORDER BY u.created_at DESC LIMIT 100`, [search]),
  ]);
  return <>
    <div className="page-heading"><h1>{t("console.nav.users")}</h1><p>{t("console.usersLead")}</p></div>
    <Notice t={t} error={params.error} success={params.success} />
    <section className="panel admin-panel"><h2><UserCheck size={20} /> {t("admin.applications")} {applications.length > 0 && <span className="tab-count">{applications.length}</span>}</h2>
      {!applications.length && <p className="muted">{t("admin.noApplications")}</p>}
      {applications.map((application) => <div className="admin-row" key={application.id}><div><strong>{application.name}</strong>
        <p>{application.email} · {f.date(application.created_at)}</p>
        {application.phone && <a className="text-link" href={`https://wa.me/${application.phone}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> +{application.phone}</a>}</div>
        <form action={approveSeller}><input type="hidden" name="id" value={application.id} /><input type="hidden" name="back" value="/admin/users" />
          <button className="button primary small">{t("admin.approveSeller")}</button></form></div>)}
    </section>
    <section className="panel admin-panel"><h2><Users size={20} /> {t("admin.users")}</h2>
      <form className="inline-form user-search" action="/admin/users">
        <input name="q" defaultValue={search} placeholder={t("admin.searchUsers")} aria-label={t("admin.searchUsers")} maxLength={100} />
        <button className="button outline small"><Search size={15} /> {t("search.button")}</button></form>
      {!users.length && <p className="muted">{t("admin.noUsers")}</p>}
      {users.map((person) => <div className="admin-row user-row" key={person.id}>
        <div><strong>{person.name} <span className={`status status-${person.banned_at ? "rejected" : person.role === "seller" ? "active" : "paused"}`}>{person.banned_at ? t("admin.banned") : t(`role.${person.role}`)}</span></strong>
          <p>{person.email}{person.phone && ` · +${person.phone}`} · {t("admin.userMeta", { orders: person.orders, listings: person.listings, date: f.date(person.created_at) })}</p></div>
        {person.id !== admin.id && <div className="inline-form">
          <details className="reset-password"><summary><KeyRound size={14} /> {t("console.resetPassword")}</summary>
            <form action={adminSetPassword} className="inline-form"><input type="hidden" name="id" value={person.id} />
              <input name="password" type="text" minLength={12} maxLength={128} required placeholder={t("console.newPasswordPh")} aria-label={t("task.newPassword")} autoComplete="off" />
              <button className="button outline small">{t("console.setPassword")}</button></form></details>
          {person.role !== "admin" && <form action={setBan}><input type="hidden" name="id" value={person.id} /><input type="hidden" name="ban" value={String(!person.banned_at)} />
            <button className={person.banned_at ? "button outline small" : "button ghost small danger"}><Ban size={14} /> {person.banned_at ? t("admin.unban") : t("admin.ban")}</button></form>}
        </div>}
      </div>)}
    </section>
  </>;
}
