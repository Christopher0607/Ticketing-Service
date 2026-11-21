import Link from "next/link";
import { notFound } from "next/navigation";
import { requestPasswordReset, resetPassword, verifyEmail } from "../../actions";
import { Notice } from "../../ui";

export const metadata = { title: "Account access", referrer: "no-referrer" as const };

export default async function IdentityPage({ params, searchParams }: {
  params: Promise<{ task: string }>;
  searchParams: Promise<{ token?: string; error?: string; success?: string }>;
}) {
  const [{ task }, { token, error, success }] = await Promise.all([params, searchParams]);
  if (!["verify","recover","reset"].includes(task)) notFound();
  const isVerify = task === "verify";
  const isRecover = task === "recover";
  const tokenValid = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  return <div className="shell page auth-page"><section className="panel auth-card">
    <h1>{isVerify ? "Verify your email" : "Reset your password"}</h1>
    <Notice error={error} success={success} />
    {isRecover ? <form action={requestPasswordReset} className="form-stack">
      <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <button className="button primary">Send reset link</button>
    </form> : tokenValid ? <form action={isVerify ? verifyEmail : resetPassword} className="form-stack">
      <input type="hidden" name="token" value={token} />
      {!isVerify && <label>New password<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label>}
      <button className="button primary">{isVerify ? "Verify email" : "Update password"}</button>
    </form> : <p>Open a new link from your email to continue.</p>}
    <Link href="/account" className="text-link">Back to my account</Link>
  </section></div>;
}
