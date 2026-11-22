import { timingSafeEqual } from "node:crypto";
import { paymentMode } from "@/lib/config";
import { query } from "@/lib/db";
import { mailConfigured } from "@/lib/identity";
import { remoteStorage } from "@/lib/storage";

/** Public: { ok }. With "Authorization: Bearer <JOB_SECRET>": configuration details for diagnosing a deployment. */
export async function GET(request: Request) {
  const secret = process.env.JOB_SECRET ?? "";
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  const detailed = secret.length >= 32 && given.length === expected.length && timingSafeEqual(given, expected);
  let database: { ok: boolean; code?: string; migrations?: number; admins?: number } = { ok: false };
  if (process.env.DATABASE_URL) {
    try {
      const [row] = await query<{ migrations: number; admins: number }>(
        "SELECT (SELECT count(*)::int FROM schema_migrations) AS migrations, (SELECT count(*)::int FROM users WHERE role='admin') AS admins");
      database = { ok: true, ...row };
    } catch (error) {
      database = { ok: false, code: String((error as { code?: string }).code ?? (error instanceof Error ? error.message.slice(0, 80) : "error")) };
    }
  } else database = { ok: false, code: "DATABASE_URL_MISSING" };
  const body = detailed
    ? { ok: database.ok, database, paymentMode: paymentMode(), storage: remoteStorage() ? "supabase" : "database", mail: mailConfigured(),
        setupToken: (process.env.SETUP_TOKEN ?? "").length >= 24, appUrl: process.env.APP_URL ?? null }
    : { ok: database.ok };
  return Response.json(body, { status: database.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
