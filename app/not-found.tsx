import Link from "next/link";
import { i18n } from "@/lib/i18n";
import { Empty } from "./ui";

export default async function NotFound() {
  const { t } = await i18n();
  return <div className="shell page"><Empty title={t("empty.notFound")}><Link href="/events" className="button primary">{t("account.explore")}</Link></Empty></div>;
}
