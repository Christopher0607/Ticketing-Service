export type PaymentMode = "demo" | "stripe";

export function paymentMode(): PaymentMode | null {
  if (process.env.PAYMENT_MODE === "stripe" && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) return "stripe";
  if (process.env.PAYMENT_MODE === "demo" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(process.env.APP_URL ?? "")) return "demo";
  return null;
}

export function appUrl() {
  const configured = new URL(process.env.APP_URL ?? "http://localhost:3000");
  if (configured.protocol !== "https:" && !(configured.protocol === "http:" && ["localhost", "127.0.0.1"].includes(configured.hostname))) {
    throw new Error("APP_URL must use HTTPS outside localhost");
  }
  return configured.origin;
}
