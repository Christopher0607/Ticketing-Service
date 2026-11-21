export const categories = ["Concerts", "Festivals", "Sports", "Arts & Theatre"] as const;
export type Category = (typeof categories)[number];
export type EventImage = "concert" | "festival" | "sports" | "theatre" | "hero";

export const money = (sen: number) => new Intl.NumberFormat("en-MY", {
  style: "currency", currency: "MYR", minimumFractionDigits: sen % 100 === 0 ? 0 : 2,
}).format(sen / 100).replace(/\s/g, "");

export const fee = (sen: number, bps: number) => Math.floor((sen * bps + 5000) / 10000);
export const percent = (bps: number) => `${bps / 100}%`;
export const date = (value: Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  ...(options ?? { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
}).format(new Date(value));
export const time = (value: Date) => date(value, { hour: "numeric", minute: "2-digit", hour12: true });
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const statusLabel: Record<string, string> = {
  reserved: "Awaiting payment", paid: "Awaiting transfer", delivered: "Tickets transferred",
  confirmed: "Received", refund_requested: "Refund requested", refund_pending: "Refund processing",
  refunded: "Refunded", cancelled: "Cancelled", disputed: "Payment disputed", expired: "Reservation expired",
  active: "Live", pending: "In review", rejected: "Declined", paused: "Paused",
};
