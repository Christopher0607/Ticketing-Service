import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { i18n } from "@/lib/i18n";
import { adminSignIn } from "@/app/actions";
import { LangSwitch } from "@/app/client";
import { Notice } from "@/app/ui";

export const metadata = { title: "Admin sign in" };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const [user, params, { t, locale }] = await Promise.all([currentUser(), searchParams, i18n()]);
  if (user?.role === "admin") redirect("/admin");
  return <main id="content" className="console-login">
    <div className="console-login-lang"><LangSwitch to={locale === "zh" ? "en" : "zh"} label={t("lang.switch")} title={t("lang.label")} /></div>
    <section className="panel auth-card console-login-card">
      <img src="/logo.png" alt="" className="auth-logo" width={72} height={72} />
      <p className="console-badge"><LockKeyhole size={14} /> {t("console.admin")}</p>
      <h1>{t("console.signInTitle")}</h1>
      <p>{t("console.signInLead")}</p>
      {user && <p className="notice">{t("console.notAdmin", { email: user.email })}</p>}
      <Notice t={t} error={params.error} />
      <form className="form-stack" action={adminSignIn}>
        <input type="hidden" name="next" value={typeof params.next === "string" ? params.next : "/admin"} />
        <label>{t("account.email")}<input required name="email" type="email" autoComplete="username" maxLength={254} /></label>
        <label>{t("account.password")}<input required name="password" type="password" autoComplete="current-password" maxLength={128} /></label>
        <button className="button primary">{t("account.signInBtn")}</button>
      </form>
      <p className="auth-switch"><Link className="text-link" href="/">{t("console.backToSite")}</Link></p>
    </section>
  </main>;
}
