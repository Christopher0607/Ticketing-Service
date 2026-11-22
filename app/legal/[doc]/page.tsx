import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, TriangleAlert } from "lucide-react";
import { legalDocs, legalSlugs, legalUpdated, type LegalSlug } from "@/content/legal";
import { appUrl, site } from "@/lib/config";
import { percent } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { fees } from "@/lib/market";

type Params = { params: Promise<{ doc: string }> };
const isSlug = (value: string): value is LegalSlug => (legalSlugs as readonly string[]).includes(value);

export async function generateMetadata({ params }: Params) {
  const [{ doc }, { locale }] = await Promise.all([params, i18n()]);
  return isSlug(doc) ? { title: legalDocs[locale][doc].title, description: legalDocs[locale][doc].summary } : { title: "Legal" };
}

export default async function LegalPage({ params }: Params) {
  const [{ doc }, { t, locale, f }, settings] = await Promise.all([params, i18n(), fees()]);
  if (!isSlug(doc)) notFound();
  const company = site.company();
  let url = "http://localhost:3000";
  try { url = appUrl(); } catch { /* local default */ }
  const values: Record<string, string> = {
    company: company.name, regNo: company.regNo, address: company.address,
    email: site.supportEmail() ?? "[support email]", site: url,
    buyerFee: percent(settings.buyer_bps), sellerFee: percent(settings.seller_bps),
  };
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
  const page = legalDocs[locale][doc];
  return <div className="shell page legal-page">
    <nav className="legal-tabs" aria-label={t("footer.policies")}>{legalSlugs.map((slug) => <Link key={slug} href={`/legal/${slug}`}
      className={slug === doc ? "chip active" : "chip"} aria-current={slug === doc ? "page" : undefined}>{legalDocs[locale][slug].title}</Link>)}</nav>
    <div className="page-heading"><span className="empty-icon"><FileText size={22} /></span><h1>{page.title}</h1><p>{page.summary}</p>
      <p className="muted">{t("legal.updated", { date: f.date(new Date(`${legalUpdated}T00:00:00+08:00`), { day: "numeric", month: "long", year: "numeric" }) })}</p></div>
    {process.env.LEGAL_REVIEWED !== "true" && <p className="notice"><TriangleAlert size={16} /> {t("legal.draft")}</p>}
    <div className="legal-grid">
      <aside className="legal-toc panel"><strong>{t("legal.contents")}</strong>
        <ol>{page.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.heading.replace(/^\d+\.\s*/, "")}</a></li>)}</ol></aside>
      <article className="legal-body">
        {page.sections.map((section) => {
          const blocks: React.ReactNode[] = [];
          let items: string[] = [];
          const flush = () => { if (items.length) { blocks.push(<ul key={`l${blocks.length}`}>{items.map((item) => <li key={item}>{fill(item)}</li>)}</ul>); items = []; } };
          for (const line of section.body) {
            if (line.startsWith("- ")) items.push(line.slice(2));
            else { flush(); blocks.push(<p key={`p${blocks.length}`}>{fill(line)}</p>); }
          }
          flush();
          return <section key={section.id} id={section.id}><h2>{section.heading}</h2>{blocks}</section>;
        })}
      </article>
    </div>
  </div>;
}

export function generateStaticParams() {
  return legalSlugs.map((doc) => ({ doc }));
}
