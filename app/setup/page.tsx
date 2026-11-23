import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { query } from "@/lib/db";
import { i18n } from "@/lib/i18n";
import { createFirstAdmin } from "@/app/actions";
import { Notice, SetupPending } from "@/app/ui";
import { databaseConfigured } from "@/lib/config";

export const metadata = { title: "Setup", robots: { index: false, follow: false } };

/** One-time page to create the first administrator. Needs ?token=SETUP_TOKEN and disappears once an admin exists. */
export default async function Setup({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const [{ token, error }, { t }] = await Promise.all([searchParams, i18n()]);
  if (!databaseConfigured()) return <SetupPending t={t} />;
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 24 || token !== expected) notFound();
  const [existing] = await query<{ count: number }>("SELECT count(*)::int AS count FROM users WHERE role='admin'");
  if (existing.count > 0) notFound();
  return <main id="content" className="shell page auth-page standalone-page">
    <section className="panel auth-card">
      <img src="/logo-240.webp" alt="" className="auth-logo" width={72} height={72} />
      <p className="console-badge"><ShieldCheck size={14} /> {t("setup.badge")}</p>
      <h1>{t("setup.title")}</h1>
      <p>{t("setup.lead")}</p>
      <Notice t={t} error={error} />
      <form className="form-stack" action={createFirstAdmin}>
        <input type="hidden" name="token" value={token} />
        <label>{t("account.name")}<input required name="name" minLength={2} maxLength={80} autoComplete="name" /></label>
        <label>{t("account.email")}<input required name="email" type="email" maxLength={254} autoComplete="username" /></label>
        <label>{t("account.password")}<input required name="password" type="password" minLength={14} maxLength={128} autoComplete="new-password" /></label>
        <small>{t("setup.passwordHint")}</small>
        <button className="button primary">{t("setup.create")}</button>
      </form>
    </section>
  </main>;
}
