import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { uuid } from "@/lib/format";
import { getObject } from "@/lib/storage";

/** A buyer's payment receipt, visible only to that buyer and administrators. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([currentUser(), params]);
  if (!user || !uuid.test(id)) return new Response("Not found", { status: 404 });
  const [receipt] = await query<{ receipt_file: Buffer | null; receipt_path: string | null }>(
    "SELECT receipt_file,receipt_path FROM orders WHERE id=$1 AND (receipt_file IS NOT NULL OR receipt_path IS NOT NULL) AND ($2 OR buyer_id=$3)",
    [id, user.role === "admin", user.id]);
  if (!receipt) return new Response("Not found", { status: 404 });
  const data = receipt.receipt_file ?? (receipt.receipt_path ? (await getObject("private", receipt.receipt_path))?.data : null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
