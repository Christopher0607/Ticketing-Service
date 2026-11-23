import type { Metadata, Viewport } from "next";
import { preconnect } from "react-dom";
import { appUrl } from "@/lib/config";
import { i18n } from "@/lib/i18n";
import "./styles.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await i18n();
  let metadataBase: URL | undefined;
  try { metadataBase = new URL(appUrl()); } catch { metadataBase = undefined; }
  return {
    metadataBase,
    title: { default: t("meta.title"), template: `%s | ${t("brand.name")} ${t("brand.tagline")}` },
    description: t("meta.description"),
    applicationName: "Crazy Monkey Tickets",
    appleWebApp: { capable: true, title: "Crazy Monkey", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = { themeColor: "#090806", colorScheme: "dark", width: "device-width", initialScale: 1 };

export const dynamic = "force-dynamic";

/** Shared document shell. The customer site, seller centre and admin console add their own layouts. */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { t, locale } = await i18n();
  // Posters are served from Supabase Storage: open that connection early.
  try { if (process.env.SUPABASE_URL) preconnect(new URL(process.env.SUPABASE_URL).origin); } catch { /* invalid URL */ }
  return <html lang={locale === "zh" ? "zh-Hans-MY" : "en-MY"}><body>
    <a className="skip" href="#content">{t("skip")}</a>
    {children}
    {/* Netlify's free-plan badge script skips rendering when these ids already exist; CSS hides it regardless. */}
    <div id="nl-badge-frame" hidden aria-hidden="true" /><div id="nl-hud-frame" hidden aria-hidden="true" />
  </body></html>;
}
