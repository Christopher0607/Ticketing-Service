import { query } from "@/lib/db";
import { mediaUrl, uuid } from "@/lib/format";
import { remoteStorage } from "@/lib/storage";

/** Public images (posters, seat maps, payment QR). IDs change on every upload, so responses are immutable. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return new Response("Not found", { status: 404 });
  const [media] = await query<{ data: Buffer | null; mime: string; remote: boolean }>("SELECT data,mime,remote FROM media WHERE id=$1", [id]);
  if (!media) return new Response("Not found", { status: 404 });
  if (!media.data) {
    if (!media.remote || !remoteStorage()) return new Response("Not found", { status: 404 });
    return new Response(null, { status: 308, headers: { Location: mediaUrl(id, true), "Cache-Control": "public, max-age=31536000, immutable" } });
  }
  return new Response(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
