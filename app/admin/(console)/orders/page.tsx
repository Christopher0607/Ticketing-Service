import Link from "next/link";
import { ClipboardList, Download, Search } from "lucide-react";
import { i18n, type MessageKey } from "@/lib/i18n";
import { searchOrders } from "@/lib/orders";
import { OrderRows } from "@/app/admin/parts";

export const metadata = { title: "Orders" };

const groups: Record<string, string[]> = {
  all: [], verifying: ["verifying"], paid: ["paid"], delivered: ["delivered"], confirmed: ["confirmed"],
  refunds: ["refund_requested", "refund_pending", "refunded", "disputed"], closed: ["cancelled", "expired"],
};

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  const [params, { t }] = await Promise.all([searchParams, i18n()]);
  const show = params.show && params.show in groups ? params.show : "all";
  const search = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const orders = await searchOrders({ statuses: groups[show], search });
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const href = (value: string) => `/admin/orders?${new URLSearchParams(Object.entries({ show: value === "all" ? "" : value, q: search }).filter(([, v]) => v))}`;
  return <>
    <div className="page-heading"><h1>{t("admin.orders")}</h1><p>{t("console.ordersLead")}</p></div>
    <div className="console-toolbar">
      <form action="/admin/orders" className="inline-form console-search"><input type="hidden" name="show" value={show === "all" ? "" : show} />
        <input name="q" defaultValue={search} placeholder={t("console.searchOrders")} aria-label={t("console.searchOrders")} maxLength={100} />
        <button className="button outline small"><Search size={15} /> {t("search.button")}</button></form>
      <div className="chip-row">{Object.keys(groups).map((value) => <Link key={value} href={href(value)} className={value === show ? "chip active" : "chip"}>{t(`console.show.${value}` as MessageKey)}</Link>)}</div>
    </div>
    <section className="panel admin-panel"><h2><ClipboardList size={20} /> {t("console.results", { count: orders.length })}</h2>
      <OrderRows t={t} orders={orders} empty={t("admin.noOrders")} /></section>
    <section className="panel admin-panel export-panel"><h2><Download size={20} /> {t("admin.export")}</h2><p className="muted">{t("admin.exportLead")}</p>
      <form action="/api/admin/orders.csv" method="get" className="inline-form">
        <label>{t("admin.from")}<input type="date" name="from" defaultValue={`${today.slice(0, 8)}01`} required /></label>
        <label>{t("admin.to")}<input type="date" name="to" defaultValue={today} required /></label>
        <button className="button outline"><Download size={16} /> {t("admin.download")}</button>
      </form></section>
  </>;
}
