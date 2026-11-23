import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { query } from "./db";

export type User = {
  id: string; name: string; email: string; role: "buyer" | "seller" | "admin"; stripe_account: string | null; stripe_ready: boolean;
  email_verified: boolean; phone: string | null; payout_bank: string | null; payout_name: string | null; payout_account: string | null;
};
const sessionCookie = "cm_session";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function passwordMatches(password: string, hash: string) {
  const [salt, expected] = hash.split(":");
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, "hex"));
}

export async function authAllowed(email: string) {
  const head = await headers();
  // Behind Caddy/nginx use X-Real-IP (overwritten by the proxy); on Netlify set CLIENT_IP_HEADER=x-nf-client-connection-ip.
  const ip = head.get((process.env.CLIENT_IP_HEADER || "x-real-ip").toLowerCase()) ?? "local";
  const counters = await query<{ key: string; attempts: number }>(`
    INSERT INTO auth_limits (key, attempts) VALUES ($1, 1), ($2, 1)
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN auth_limits.window_start < now() - interval '15 minutes' THEN 1 ELSE auth_limits.attempts + 1 END,
      window_start = CASE WHEN auth_limits.window_start < now() - interval '15 minutes' THEN now() ELSE auth_limits.window_start END
    RETURNING key, attempts`, [`email:${digest(email)}`, `ip:${digest(ip)}`]);
  return counters.every((counter) => counter.attempts <= (counter.key.startsWith("email:") ? 12 : 120));
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await query("INSERT INTO sessions VALUES ($1, $2, now() + interval '30 days')", [digest(token), userId]);
  (await cookies()).set(sessionCookie, token, {
    httpOnly: true, secure: process.env.APP_URL?.startsWith("https://"),
    sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash=$1", [digest(token)]);
  jar.delete(sessionCookie);
}

/** The signed-in user, looked up once per request however many components ask. */
export const currentUser = cache(async () => {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [user] = await query<User>(`SELECT u.id,u.name,u.email,u.role,u.stripe_account,u.stripe_ready,u.email_verified,u.phone,u.payout_bank,u.payout_name,u.payout_account
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.banned_at IS NULL`, [digest(token)]);
  return user ?? null;
});

export async function requireUser(path = "/account", role?: User["role"]) {
  const user = await currentUser();
  if (!user) redirect(`/account?next=${encodeURIComponent(path)}`);
  if (role && user.role !== role) redirect(path === "/sell" ? "/account?notice=seller-access" : "/account");
  return user;
}

/** Admin console guard: anyone who isn't a signed-in administrator goes to the admin login. */
export async function requireAdmin(path = "/admin") {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect(`/admin/login${path !== "/admin" ? `?next=${encodeURIComponent(path)}` : ""}`);
  return user;
}

/** Seller centre guard: signed-out visitors sign in first; buyers see the seller landing page. */
export async function requireSeller(path = "/sell") {
  const user = await currentUser();
  if (!user) redirect(`/account?next=${encodeURIComponent(path)}`);
  if (user.role !== "seller") redirect("/sell");
  return user;
}
