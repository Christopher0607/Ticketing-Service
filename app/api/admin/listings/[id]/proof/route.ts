import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { uuid } from "@/lib/format";
import { getObject } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([currentUser(), params]);
  if (user?.role !== "admin" || !uuid.test(id)) return new Response("Not found", { status: 404 });
  const [proof] = await query<{ proof_file: Buffer | null; proof_path: string | null; proof_type: string }>(
    "SELECT proof_file,proof_path,proof_type FROM listings WHERE id=$1 AND proof_type IS NOT NULL", [id]);
  if (!proof) return new Response("Not found", { status: 404 });
  const data = proof.proof_file ?? (proof.proof_path ? (await getObject("private", proof.proof_path))?.data : null);
  if (!data) return new Response("Not found", { status: 404 });
  const extension = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" }[proof.proof_type];
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="listing-proof.${extension}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
