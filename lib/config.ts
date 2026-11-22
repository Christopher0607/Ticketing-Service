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
  /** Legal entity details shown in the footer and legal pages (placeholders until set). */
  company: () => ({
    name: process.env.COMPANY_NAME || "[Company name] Sdn. Bhd.",
    regNo: process.env.COMPANY_REG_NO || "[SSM registration no.]",
    address: process.env.COMPANY_ADDRESS || "[Registered address]",
  }),
  /** Link to the Crazy Monkey group-buy site. */
  groupBuyUrl: () => publicHttps(process.env.GROUPBUY_URL),
};
