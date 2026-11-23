import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uuid } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { orderById } from "@/lib/orders";
import { OrderView } from "@/app/order-view";

export const metadata = { title: "Order" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string; payment?: string }> };

/** Buyer's view of an order. Sellers and administrators are sent to their own consoles. */
export default async function BuyerOrder({ params, searchParams }: Props) {
  const [{ id }, notice, { t }] = await Promise.all([params, searchParams, i18n()]);
  if (!uuid.test(id)) notFound();
  const [user, order] = await Promise.all([requireUser(`/orders/${id}`), orderById(id)]);
  if (!order) notFound();
  if (order.buyer_id !== user.id) {
    if (order.seller_id === user.id) redirect(`/sell/orders/${id}`);
    if (user.role === "admin") redirect(`/admin/orders/${id}`);
    notFound();
  }
  return <div className="shell page"><OrderView order={order} viewer="buyer" notice={notice} back={{ href: "/account", label: t("order.backBuyer") }} /></div>;
}
