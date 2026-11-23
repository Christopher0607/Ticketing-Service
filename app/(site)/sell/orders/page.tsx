import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadFor, requireSeller } from "@/lib/auth";
import { money } from "@/lib/format";
import { i18n, type MessageKey } from "@/lib/i18n";
import { sellerOrders } from "@/lib/orders";
import { Empty, Status } from "@/app/ui";

export const metadata = { title: "Sales" };

const groups: Record<string, string[]> = { all: [], paid: ["paid"], delivered: ["delivered"], confirmed: ["confirmed"], refunds: ["refund_requested", "refund_pending", "refunded", "disputed"] };

export default async function SellerSales({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const params = await searchParams;
  const show = params.show && params.show in groups ? params.show : "all";
  const [[, loaded], { t, f }] = await Promise.all([loadFor(requireSeller("/sell/orders"), (id) => sellerOrders(id, groups[show])), i18n()]);
  const orders = loaded!;
  return <>
    <div className="page-heading"><h1>{t("seller.nav.orders")}</h1><p>{t("seller.ordersLead")}</p></div>
    <div className="chip-row">{Object.keys(groups).map((value) => <Link key={value} href={`/sell/orders${value === "all" ? "" : `?show=${value}`}`} className={value === show ? "chip active" : "chip"}>
      {t(`seller.show.${value}` as MessageKey)}</Link>)}</div>
    <section className="panel admin-panel">
      {orders.length ? orders.map((order) => <Link className="admin-row admin-order" href={`/sell/orders/${order.id}`} key={order.id}>
        <div><strong>{order.title}</strong><p>{f.date(order.created_at)} · {order.quantity} × {order.section} · {t("seller.proceeds", { qty: order.quantity, amount: money(order.subtotal - order.seller_fee) })}</p></div>
        <Status t={t} value={order.settled_at && order.status === "confirmed" ? "settled" : order.status} /><ArrowRight size={16} /></Link>) :
        <Empty title={t("seller.noSales")} />}
    </section>
  </>;
}
