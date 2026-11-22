export const categories = ["Concerts", "Festivals", "Sports", "Arts & Theatre"] as const;
export type Category = (typeof categories)[number];
export type EventImage = "concert" | "festival" | "sports" | "theatre" | "hero";

export const money = (sen: number) => new Intl.NumberFormat("en-MY", {
  style: "currency", currency: "MYR", minimumFractionDigits: sen % 100 === 0 ? 0 : 2,
}).format(sen / 100).replace(/\s/g, "");

export const fee = (sen: number, bps: number) => Math.floor((sen * bps + 5000) / 10000);
export const percent = (bps: number) => `${bps / 100}%`;
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

/** Markup of a resale price over face value, in basis points (negative when below face value). */
export const markupBps = (price: number, face: number) => Math.round(((price - face) * 10000) / face);

export const posterUrl = (item: { poster_id?: string | null; image: string }) =>
  item.poster_id ? `/media/${item.poster_id}` : `/images/${item.image}.webp`;

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
