import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { paymentMode, site, databaseConfigured } from "@/lib/config";
import { i18n } from "@/lib/i18n";
import { Footer, Header, SetupPending } from "@/app/ui";

/** Customer-facing website: shop header, footer and mobile tab bar. */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [{ t }, head] = await Promise.all([i18n(), headers()]);
  // On a dedicated admin domain, send visitors straight to the console.
  if (site.adminHost() && head.get("host")?.toLowerCase() === site.adminHost()) redirect("/admin");
  if (!databaseConfigured()) return <SetupPending t={t} />;
  return <>
    <Header />
    {paymentMode() === "demo" && <div className="demo-banner">{t("demo.banner")}</div>}
    <main id="content">{children}</main>
    <Footer />
  </>;
}
