import Link from "next/link";
import { notFound } from "next/navigation";
import { i18n } from "@/lib/i18n";
import { requestPasswordReset, resetPassword, verifyEmail } from "../../actions";
import { Notice } from "../../ui";

export const metadata = { title: "Account", referrer: "no-referrer" as const };

export default async function IdentityPage({ params, searchParams }: {
  params: Promise<{ task: string }>;
  searchParams: Promise<{ token?: string; error?: string; success?: string }>;
}) {
  const [{ task }, { token, error, success }, { t }] = await Promise.all([params, searchParams, i18n()]);
  if (!["verify","recover","reset"].includes(task)) notFound();
  const isVerify = task === "verify";
  const isRecover = task === "recover";
  const tokenValid = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  return <div className="shell page auth-page"><section className="panel auth-card">
    <img src="/logo.png" alt="" className="auth-logo" width={72} height={72} />
    <h1>{isVerify ? t("task.verify") : t("task.reset")}</h1>
    <Notice t={t} error={error} success={success} />
    {isRecover ? <form action={requestPasswordReset} className="form-stack">
      <label>{t("account.email")}<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <button className="button primary">{t("task.sendReset")}</button>
    </form> : tokenValid ? <form action={isVerify ? verifyEmail : resetPassword} className="form-stack">
      <input type="hidden" name="token" value={token} />
      {!isVerify && <label>{t("task.newPassword")}<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label>}
      <button className="button primary">{isVerify ? t("task.verifyBtn") : t("task.update")}</button>
    </form> : <p>{t("task.newLink")}</p>}
    <Link href="/account" className="text-link">{t("task.back")}</Link>
  </section></div>;
}
