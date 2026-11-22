import Link from "next/link";
import { BadgeCheck, CreditCard, ShieldCheck, Ticket, Wallet } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { SupportLinks } from "../ui";

export async function generateMetadata() {
  const { t } = await i18n();
  return { title: t("nav.how") };
}

const faq = [["how.q1", "how.a1"], ["how.q2", "how.a2"], ["how.q3", "how.a3"], ["how.q4", "how.a4"], ["how.q5", "how.a5"], ["how.q6", "how.a6"], ["how.q7", "how.a7"]] as const;

export default async function Help() {
  const { t } = await i18n();
  const steps = [
    [CreditCard, "home.step1.title", "home.step1.body"],
    [Ticket, "home.step2.title", "home.step2.body"],
    [BadgeCheck, "home.step3.title", "home.step3.body"],
    [Wallet, "home.step4.title", "home.step4.body"],
  ] as const;
  return <div className="shell page">
    <div className="page-heading centered"><span className="empty-icon"><ShieldCheck size={24} /></span><h1>{t("how.title")}</h1><p>{t("how.lead")}</p></div>
    <ol className="steps vertical-mobile">{steps.map(([Icon, title, body], index) => <li key={title}>
      <span className="step-number">0{index + 1}</span><Icon size={24} className="step-icon" /><h3>{t(title)}</h3><p>{t(body)}</p>
    </li>)}</ol>
    <section className="panel faq"><h2>{t("how.faq")}</h2>
      {faq.map(([q, a]) => <details key={q}><summary>{t(q)}</summary><p>{t(a)}</p></details>)}
    </section>
    <div className="inline-form centered-row"><Link href="/events" className="button primary">{t("account.explore")}</Link><Link className="button outline" href="/account">{t("how.orders")}</Link></div>
    <SupportLinks t={t} />
  </div>;
}
