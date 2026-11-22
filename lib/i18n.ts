import { cookies, headers } from "next/headers";
import { en, zh, type MessageKey } from "./messages";
import { formatters } from "./format";

export type { MessageKey };

export type Locale = "zh" | "en";
export const localeCookie = "cm_lang";
const dictionaries = { zh, en } as const;

export const isLocale = (value: unknown): value is Locale => value === "zh" || value === "en";

/** Cookie first, then the browser's first preferred language. Chinese is the default. */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(localeCookie)?.value;
  if (isLocale(saved)) return saved;
  const first = ((await headers()).get("accept-language") ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return !first || first.startsWith("zh") ? "zh" : "en";
}

export type Translate = ((key: MessageKey, vars?: Record<string, string | number>) => string) & {
  has: (key: string) => key is MessageKey;
};

export function translator(locale: Locale): Translate {
  const dictionary = dictionaries[locale];
  const t = ((key: MessageKey, vars?: Record<string, string | number>) => {
    const template: string = dictionary[key] ?? en[key] ?? key;
    return vars ? template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : template;
  }) as Translate;
  t.has = (key: string): key is MessageKey => Object.hasOwn(en, key);
  return t;
}

/** Everything a server component needs to render localized text. */
export async function i18n() {
  const locale = await getLocale();
  return { locale, t: translator(locale), f: formatters(locale) };
}
