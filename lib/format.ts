export const categories = ["Concerts", "Festivals", "Sports", "Arts & Theatre"] as const;
export type Category = (typeof categories)[number];
export type EventImage = "concert" | "festival" | "sports" | "theatre" | "hero";

export const money = (sen: number) => new Intl.NumberFormat("en-MY", {
  style: "currency", currency: "MYR", minimumFractionDigits: sen % 100 === 0 ? 0 : 2,
}).format(sen / 100).replace(/\s/g, "");

export const fee = (sen: number, bps: number) => Math.floor((sen * bps + 5000) / 10000);
export const percent = (bps: number) => `${bps / 100}%`;
/** Percentage rounded to one decimal place, for display. */
export const percentRounded = (bps: number) => `${Math.round(bps / 10) / 10}%`;
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

/** Markup of a resale price over face value, in basis points (negative when below face value). */
export const markupBps = (price: number, face: number) => Math.round(((price - face) * 10000) / face);

/** Public image URL: Supabase Storage's CDN for files stored there, otherwise served from the database. */
export function mediaUrl(id: string, remote?: boolean | null) {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  return remote && base ? `${base}/storage/v1/object/public/media/${id}.webp` : `/media/${id}`;
}

/** Link that downloads an image (e.g. the DuitNow QR) so buyers can scan it from their gallery. */
export function mediaDownloadUrl(id: string, remote?: boolean | null) {
  return remote && process.env.SUPABASE_URL ? `${mediaUrl(id, true)}?download=crazy-monkey-duitnow-qr.webp` : `/media/${id}?download=1`;
}

export const posterUrl = (item: { poster_id?: string | null; poster_remote?: boolean | null; image: string }) =>
  item.poster_id ? mediaUrl(item.poster_id, item.poster_remote) : `/images/${item.image}.webp`;

const timeZone = "Asia/Kuala_Lumpur";

export function formatters(locale: "zh" | "en") {
  const tag = locale === "zh" ? "zh-CN" : "en-GB";
  const date = (value: Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, {
    timeZone, ...(options ?? { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
  }).format(new Date(value));
  return {
    date,
    time: (value: Date) => date(value, { hour: "numeric", minute: "2-digit", hour12: locale === "en" }),
    day: (value: Date) => date(value, { day: "numeric" }).replace(/\D/g, ""),
    month: (value: Date) => locale === "zh" ? date(value, { month: "numeric" }).replace(/\D/g, "") + "月" : date(value, { month: "short" }).toUpperCase(),
    weekday: (value: Date) => date(value, { weekday: "short" }),
  };
}
export type Formatters = ReturnType<typeof formatters>;
