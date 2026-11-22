import { cookies } from "next/headers";
import { isLocale, localeCookie } from "@/lib/i18n";

/** GET /lang?to=en&next=/events — remembers the language and returns to the same page. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get("to");
  const next = url.searchParams.get("next") ?? "/";
  const target = /^\/(?![/\\])[\w\-/.?=&%]*$/.test(next) ? next : "/";
  if (isLocale(to)) {
    (await cookies()).set(localeCookie, to, { path: "/", maxAge: 365 * 24 * 60 * 60, sameSite: "lax" });
  }
  return new Response(null, { status: 303, headers: { Location: target, "Cache-Control": "no-store" } });
}
