import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { uuid } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { orderById } from "@/lib/orders";
import { OrderView } from "@/app/order-view";

export const metadata = { title: "Sale" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> };

export default async function SellerOrder({ params, searchParams }: Props) {
  const [{ id }, notice, { t }] = await Promise.all([params, searchParams, i18n()]);
  if (!uuid.test(id)) notFound();
  const [user, order] = await Promise.all([requireSeller(`/sell/orders/${id}`), orderById(id)]);
  // Sellers only see orders once payment is confirmed.
  if (!order || order.seller_id !== user.id || ["reserved", "verifying", "expired", "cancelled"].includes(order.status)) notFound();
  return <OrderView order={order} viewer="seller" notice={notice} back={{ href: "/sell/orders", label: t("seller.nav.orders") }} />;
}
