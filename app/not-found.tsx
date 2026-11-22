import Link from "next/link";
import { i18n } from "@/lib/i18n";
import { Empty } from "./ui";

export default async function NotFound() {
  const { t } = await i18n();
  return <main id="content" className="shell page standalone-page">
    <Link href="/" className="standalone-logo"><img src="/logo.png" alt="Crazy Monkey" width={72} height={72} /></Link>
    <Empty title={t("empty.notFound")}><Link href="/events" className="button primary">{t("account.explore")}</Link></Empty>
  </main>;
}
