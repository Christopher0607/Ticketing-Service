import Link from "next/link";
import { CalendarDays, ExternalLink, LayoutDashboard, LogOut, ReceiptText, Settings, Ticket, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { i18n } from "@/lib/i18n";
import { signOut } from "@/app/actions";
import { LangSwitch, SideNav } from "@/app/client";

/** Admin console shell: sidebar navigation with live to-do counts, no customer header or footer. */
export default async function ConsoleLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [admin, { t, locale }, [counts]] = await Promise.all([requireAdmin(), i18n(), query<{ orders: number; listings: number; users: number }>(`SELECT
    (SELECT count(*)::int FROM orders o JOIN listings l ON l.id=o.listing_id JOIN events e ON e.id=l.event_id
      WHERE o.status IN ('verifying','refund_requested') OR (o.status='confirmed' AND o.settled_at IS NULL AND e.starts_at+interval '24 hours'<=now())) AS orders,
    (SELECT count(*)::int FROM listings WHERE status='pending') AS listings,
    (SELECT count(*)::int FROM users WHERE seller_requested AND role='buyer') AS users`)]);
  const items = [
    { href: "/admin", label: t("console.nav.overview"), icon: <LayoutDashboard size={18} />, exact: true },
    { href: "/admin/orders", label: t("admin.orders"), icon: <ReceiptText size={18} />, badge: counts.orders },
    { href: "/admin/listings", label: t("admin.listings"), icon: <Ticket size={18} />, badge: counts.listings },
    { href: "/admin/events", label: t("admin.tab.events"), icon: <CalendarDays size={18} /> },
    { href: "/admin/users", label: t("console.nav.users"), icon: <Users size={18} />, badge: counts.users },
    { href: "/admin/settings", label: t("admin.tab.settings"), icon: <Settings size={18} /> },
  ];
  return <div className="console">
    <aside className="console-side">
      <Link href="/admin" className="console-brand"><img src="/logo-144.webp" alt="" width={36} height={36} />
        <span><strong>CRAZY MONKEY</strong><small>{t("console.admin")}</small></span></Link>
      <SideNav items={items} label={t("console.admin")} />
      <div className="console-side-foot">
        <Link href="/" className="console-link"><ExternalLink size={16} /> {t("console.viewSite")}</Link>
        <form action={signOut}><button className="console-link"><LogOut size={16} /> {t("account.signOut")}</button></form>
      </div>
    </aside>
    <div className="console-main">
      <header className="console-top">
        <span className="console-user">{admin.name} · {admin.email}</span>
        <LangSwitch to={locale === "zh" ? "en" : "zh"} label={t("lang.switch")} title={t("lang.label")} />
      </header>
      <main id="content" className="console-content">{children}</main>
    </div>
  </div>;
}
