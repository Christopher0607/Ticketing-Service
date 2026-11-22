import { query } from "@/lib/db";
import { uuid } from "@/lib/format";

/** Public images (posters, payment QR). IDs change on every upload, so responses are immutable. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return new Response("Not found", { status: 404 });
  const [media] = await query<{ data: Buffer; mime: string }>("SELECT data,mime FROM media WHERE id=$1", [id]);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
