export type PaymentMode = "demo" | "stripe" | "manual";

const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/;

export function paymentMode(): PaymentMode | null {
  if (process.env.PAYMENT_MODE === "stripe" && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) return "stripe";
  // Manual mode: buyers pay by DuitNow QR / bank transfer and upload a receipt for the operator to verify.
  if (process.env.PAYMENT_MODE === "manual") return "manual";
  if (process.env.PAYMENT_MODE === "demo" && local.test(process.env.APP_URL ?? "")) return "demo";
  return null;
}

/** SQL predicate deciding whether a seller (aliased `s`) may currently sell, given the payment mode in `$n`. */
export const sellerReady = (param: string) =>
  `(s.banned_at IS NULL AND CASE ${param} WHEN 'stripe' THEN s.stripe_ready WHEN 'manual' THEN s.payout_account IS NOT NULL ELSE true END)`;

export const configuredMode = () => process.env.PAYMENT_MODE ?? "";

/**
 * PostgreSQL connection URL, or null when DATABASE_URL is missing or not a usable postgres:// URL.
 * DATABASE_PASSWORD, when set, replaces the URL's password, so Supabase's connection string can be
 * pasted unchanged (with its [YOUR-PASSWORD] placeholder) and passwords need no URL-encoding.
 */
export function databaseUrl(): string | null {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!/^postgres(ql)?:$/.test(url.protocol) || !url.hostname) return null;
    const password = process.env.DATABASE_PASSWORD;
    if (password) url.password = encodeURIComponent(password);
    // Supabase's placeholder, e.g. [YOUR-PASSWORD] or [YOUR-DATABASE-PASSWORD], means the password is still missing.
    const filled = decodeURIComponent(url.password);
    if (/^\[.*password.*\]$/i.test(filled) || /your[-_ ]?password/i.test(filled)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const databaseConfigured = () => databaseUrl() !== null;

export function appUrl() {
  const configured = new URL(process.env.APP_URL ?? "http://localhost:3000");
  if (configured.protocol !== "https:" && !(configured.protocol === "http:" && ["localhost", "127.0.0.1"].includes(configured.hostname))) {
    throw new Error("APP_URL must use HTTPS outside localhost");
  }
  return configured.origin;
}

function publicHttps(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export const site = {
  supportEmail: () => {
    const email = process.env.SUPPORT_EMAIL;
    return email && /^[^@\s/?]+@[^@\s/?]+\.[^@\s/?]+$/.test(email) ? email : null;
  },
  /** Digits only, international format without "+", e.g. 60123456789. */
  whatsapp: () => {
    const digits = (process.env.SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  },
  /** Optional dedicated host for the admin console, e.g. admin.example.com. */
  adminHost: () => process.env.ADMIN_HOST?.trim().toLowerCase() || null,
  /** Link to the Crazy Monkey group-buy site. */
  groupBuyUrl: () => publicHttps(process.env.GROUPBUY_URL),
  /** Official social profiles, linked in the site's structured data for search engines. */
  socialProfiles: ["https://www.instagram.com/crazymonkeyticketing/"],
};
