import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { uuid } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { orderById } from "@/lib/orders";
import { OrderView } from "@/app/order-view";

export const metadata = { title: "Order" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> };

export default async function AdminOrder({ params, searchParams }: Props) {
  const [{ id }, notice, { t }] = await Promise.all([params, searchParams, i18n()]);
  if (!uuid.test(id)) notFound();
  await requireAdmin(`/admin/orders/${id}`);
  const order = await orderById(id);
  if (!order) notFound();
  return <OrderView order={order} viewer="admin" notice={notice} back={{ href: "/admin/orders", label: t("admin.orders") }} />;
}
