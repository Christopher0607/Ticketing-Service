import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { money, shortId } from "@/lib/format";
import type { Translate } from "@/lib/i18n";
import type { Order } from "@/lib/orders";
import { Status } from "@/app/ui";

export function OrderRows({ t, orders, empty }: { t: Translate; orders: Order[]; empty: string }) {
  if (!orders.length) return <p className="muted">{empty}</p>;
  return <>{orders.map((order) => <Link className="admin-row admin-order" href={`/admin/orders/${order.id}`} key={order.id}>
    <div><strong>{order.title}</strong><p>{shortId(order.id)} · {order.buyer_name} · {money(order.subtotal + order.buyer_fee)}</p></div>
    <Status t={t} value={order.settled_at && order.status === "confirmed" ? "settled" : order.status} /><ArrowRight size={16} /></Link>)}</>;
}

