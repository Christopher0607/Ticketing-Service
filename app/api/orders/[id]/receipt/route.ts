import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { uuid } from "@/lib/format";

/** A buyer's payment receipt, visible only to that buyer and administrators. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([currentUser(), params]);
  if (!user || !uuid.test(id)) return new Response("Not found", { status: 404 });
  const [receipt] = await query<{ receipt_file: Buffer }>(
    "SELECT receipt_file FROM orders WHERE id=$1 AND receipt_file IS NOT NULL AND ($2 OR buyer_id=$3)",
    [id, user.role === "admin", user.id]);
  if (!receipt) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(receipt.receipt_file), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
