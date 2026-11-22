import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let base = "http://localhost:3000";
  try { base = appUrl(); } catch { /* local default */ }
  const [events, sellers] = await Promise.all([
    query<{ slug: string; created_at: Date }>("SELECT slug,created_at FROM events WHERE active AND starts_at>now() ORDER BY starts_at LIMIT 5000"),
    query<{ id: string }>("SELECT DISTINCT l.seller_id AS id FROM listings l JOIN users u ON u.id=l.seller_id WHERE l.status='active' AND u.banned_at IS NULL LIMIT 5000"),
  ]);
  const pages = ["", "/events", "/how-it-works", "/about", "/sell", "/legal/terms", "/legal/privacy", "/legal/refunds"];
  return [
    ...pages.map((path) => ({ url: `${base}${path}`, changeFrequency: "daily" as const, priority: path === "" ? 1 : 0.6 })),
    ...events.map((event) => ({ url: `${base}/events/${event.slug}`, lastModified: event.created_at, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...sellers.map((seller) => ({ url: `${base}/sellers/${seller.id}`, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
