import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { uuid } from "@/lib/format";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([currentUser(), params]);
  if (user?.role !== "admin" || !uuid.test(id)) return new Response("Not found", { status: 404 });
  const [proof] = await query<{ proof_file: Buffer; proof_type: string }>(
    "SELECT proof_file,proof_type FROM listings WHERE id=$1 AND proof_file IS NOT NULL", [id]);
  if (!proof) return new Response("Not found", { status: 404 });
  const extension = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" }[proof.proof_type];
  return new Response(new Uint8Array(proof.proof_file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="listing-proof.${extension}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
