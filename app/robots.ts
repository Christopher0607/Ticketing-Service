import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  let base = "http://localhost:3000";
  try { base = appUrl(); } catch { /* local default */ }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/orders", "/api/", "/lang"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
