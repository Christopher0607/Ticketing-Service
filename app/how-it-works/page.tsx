import Link from "next/link";
import { BadgeCheck, CreditCard, LifeBuoy, ShieldCheck, Tag, Ticket, Undo2, Wallet } from "lucide-react";
import { percent } from "@/lib/format";
import { i18n, type MessageKey } from "@/lib/i18n";
import { fees } from "@/lib/market";
import { SupportLinks } from "../ui";

export async function generateMetadata() {
  const { t } = await i18n();
  return { title: t("nav.help"), description: t("how.lead") };
}

const sections: { id: string; icon: typeof Ticket; title: MessageKey; items: [MessageKey, MessageKey][] }[] = [
  { id: "buying", icon: CreditCard, title: "help.cat.buy", items: [["how.q4", "how.a4"], ["how.q8", "how.a8"], ["how.q9", "how.a9"]] },
  { id: "transfer", icon: Ticket, title: "help.cat.transfer", items: [["how.q1", "how.a1"], ["how.q2", "how.a2"], ["how.q7", "how.a7"]] },
  { id: "refunds", icon: Undo2, title: "help.cat.refund", items: [["how.q10", "how.a10"], ["how.q11", "how.a11"]] },
  { id: "selling", icon: Tag, title: "help.cat.sell", items: [["how.q12", "how.a12"], ["how.q3", "how.a3"], ["how.q13", "how.a13"], ["how.q5", "how.a5"], ["how.q6", "how.a6"]] },
];

export default async function Help() {
  const [{ t }, settings] = await Promise.all([i18n(), fees()]);
  const vars = { buyer: percent(settings.buyer_bps), seller: percent(settings.seller_bps) };
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
    <nav className="chip-row help-nav" aria-label={t("how.faq")}>{sections.map((section) => <a key={section.id} href={`#${section.id}`} className="chip">{t(section.title)}</a>)}</nav>
    <div className="help-grid">
      {sections.map((section) => <section key={section.id} id={section.id} className="panel faq">
        <h2><section.icon size={20} /> {t(section.title)}</h2>
        {section.items.map(([q, a]) => <details key={q}><summary>{t(q)}</summary><p>{t(a, vars)}</p></details>)}
      </section>)}
    </div>
    <section className="panel contact-card"><div><h2><LifeBuoy size={20} /> {t("help.contactTitle")}</h2><p>{t("help.contactBody")}</p></div><SupportLinks t={t} /></section>
    <div className="inline-form centered-row"><Link href="/events" className="button primary">{t("account.explore")}</Link>
      <Link className="button outline" href="/legal/refunds">{t("footer.refunds")}</Link><Link className="button outline" href="/account">{t("how.orders")}</Link></div>
  </div>;
}
