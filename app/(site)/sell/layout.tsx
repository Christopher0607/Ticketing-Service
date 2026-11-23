import Link from "next/link";
import { ExternalLink, LayoutDashboard, ListChecks, PlusCircle, ReceiptText, Wallet } from "lucide-react";
import { currentUser, loadFor } from "@/lib/auth";
import { query } from "@/lib/db";
import { i18n } from "@/lib/i18n";
import { SideNav } from "@/app/client";

/** Seller centre: approved sellers get a sidebar workspace; everyone else sees the seller landing page. */
export default async function SellerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [[user, loaded], { t }] = await Promise.all([loadFor(currentUser(), (id) => query<{ transfer: number }>(`SELECT count(*)::int AS transfer FROM orders o JOIN listings l ON l.id=o.listing_id
    WHERE l.seller_id=$1 AND o.status='paid'`, [id])), i18n()]);
  if (user?.role !== "seller") return children;
  const [counts] = loaded!;
  const items = [
    { href: "/sell", label: t("seller.nav.overview"), icon: <LayoutDashboard size={18} />, exact: true },
    { href: "/sell/new", label: t("seller.nav.new"), icon: <PlusCircle size={18} /> },
    { href: "/sell/listings", label: t("seller.listings"), icon: <ListChecks size={18} /> },
    { href: "/sell/orders", label: t("seller.nav.orders"), icon: <ReceiptText size={18} />, badge: counts.transfer },
    { href: "/sell/payouts", label: t("seller.nav.payouts"), icon: <Wallet size={18} /> },
  ];
  return <div className="shell page seller-center">
    <aside className="seller-side">
      <div className="seller-side-head"><span className="seller-avatar small">{Array.from(user.name)[0]?.toUpperCase()}</span>
        <div><strong>{user.name}</strong><small>{t("seller.title")}</small></div></div>
      <SideNav items={items} label={t("seller.title")} />
      <Link href={`/sellers/${user.id}`} className="console-link"><ExternalLink size={16} /> {t("account.publicProfile")}</Link>
    </aside>
    <div className="seller-content">{children}</div>
  </div>;
}
