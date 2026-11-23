import Link from "next/link";
import { BadgeCheck, HandCoins, Headset, ShieldCheck } from "lucide-react";
import { site } from "@/lib/config";
import { i18n } from "@/lib/i18n";
import { SupportLinks } from "@/app/ui";

export async function generateMetadata() {
  const { t } = await i18n();
  return { title: t("about.title"), description: t("about.lead") };
}

export default async function About() {
  const { t } = await i18n();
  const company = site.company();
  const values = [
    [HandCoins, "about.v1.title", "about.v1.body"],
    [ShieldCheck, "about.v2.title", "about.v2.body"],
    [BadgeCheck, "about.v3.title", "about.v3.body"],
    [Headset, "about.v4.title", "about.v4.body"],
  ] as const;
  return <div className="shell page about-page">
    <div className="page-heading centered"><img src="/logo-384.webp" alt="" className="landing-logo" width={96} height={96} /><h1>{t("about.title")}</h1><p>{t("about.lead")}</p></div>
    <section className="panel about-story"><h2>{t("about.storyTitle")}</h2><p>{t("about.story1")}</p><p>{t("about.story2")}</p></section>
    <div className="feature-grid four">{values.map(([Icon, title, body]) => <div key={title} className="panel feature">
      <span className="feature-icon"><Icon size={22} /></span><h2>{t(title)}</h2><p>{t(body)}</p></div>)}</div>
    <section className="panel about-company"><h2>{t("about.company")}</h2>
      {company.name ? <p>{company.name}{company.regNo && ` (${company.regNo})`}{company.address && <><br />{company.address}</>}</p>
        : <p className="muted">{t("about.companyPending")}</p>}
      <SupportLinks t={t} />
    </section>
    <div className="inline-form centered-row"><Link href="/events" className="button primary">{t("account.explore")}</Link><Link href="/sell" className="button outline">{t("nav.sell")}</Link></div>
  </div>;
}
