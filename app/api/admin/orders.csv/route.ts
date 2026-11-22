import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";

/** Order ledger for bank reconciliation. Dates are Malaysia time; amounts in RM. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (user?.role !== "admin") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!day.test(from) || !day.test(to)) return new Response("Use from=YYYY-MM-DD&to=YYYY-MM-DD", { status: 400 });
  const rows = await query<Record<string, string | number | null>>(`
    SELECT o.id AS order_id, to_char(o.created_at AT TIME ZONE 'Asia/Kuala_Lumpur','YYYY-MM-DD HH24:MI') AS created_myt,
      to_char(o.paid_at AT TIME ZONE 'Asia/Kuala_Lumpur','YYYY-MM-DD HH24:MI') AS paid_myt, o.status, o.payment_mode,
      e.title AS event, to_char(e.starts_at AT TIME ZONE 'Asia/Kuala_Lumpur','YYYY-MM-DD HH24:MI') AS event_myt, l.section, o.quantity,
      u.name AS buyer, u.email AS buyer_email, s.name AS seller, s.email AS seller_email,
      round(o.subtotal/100.0,2) AS ticket_subtotal, round(o.buyer_fee/100.0,2) AS buyer_fee, round(o.seller_fee/100.0,2) AS seller_fee,
      round((o.subtotal+o.buyer_fee)/100.0,2) AS buyer_paid, round((o.subtotal-o.seller_fee)/100.0,2) AS seller_proceeds,
      round((o.buyer_fee+o.seller_fee)/100.0,2) AS commission, o.payment_ref, o.payment_intent,
      to_char(o.settled_at AT TIME ZONE 'Asia/Kuala_Lumpur','YYYY-MM-DD HH24:MI') AS settled_myt, o.payout_ref, o.refund_ref, o.refund_account
    FROM orders o JOIN listings l ON l.id=o.listing_id JOIN events e ON e.id=l.event_id
    JOIN users u ON u.id=o.buyer_id JOIN users s ON s.id=l.seller_id
    WHERE o.status NOT IN ('reserved','expired') AND (o.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date BETWEEN $1::date AND $2::date
    ORDER BY o.created_at`, [from, to]);
  const columns = ["order_id", "created_myt", "paid_myt", "status", "payment_mode", "event", "event_myt", "section", "quantity", "buyer", "buyer_email",
    "seller", "seller_email", "ticket_subtotal", "buyer_fee", "seller_fee", "buyer_paid", "seller_proceeds", "commission", "payment_ref", "payment_intent",
    "settled_myt", "payout_ref", "refund_ref", "refund_account"];
  // Quote every cell and neutralise spreadsheet formulas in user-supplied text.
  const cell = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const csv = "﻿" + [columns.join(","), ...rows.map((row) => columns.map((column) => cell(row[column] ?? null)).join(","))].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crazy-monkey-orders-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
