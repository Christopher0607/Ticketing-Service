import { Landmark, Wallet } from "lucide-react";
import { requireSeller } from "@/lib/auth";
import { paymentMode } from "@/lib/config";
import { query } from "@/lib/db";
import { money } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { sellerSummary } from "@/lib/market";
import { onboarding, refreshPayouts, savePayout } from "@/app/actions";
import { Notice } from "@/app/ui";

export const metadata = { title: "Payouts" };

export default async function SellerPayouts({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; connect?: string }> }) {
  const [user, params, { t, f }] = await Promise.all([requireSeller("/sell/payouts"), searchParams, i18n()]);
  const [summary, history] = await Promise.all([sellerSummary(user.id), query<{ id: string; title: string; settled_at: Date; amount: number; payout_ref: string | null }>(`
    SELECT o.id,e.title,o.settled_at,(o.subtotal-o.seller_fee) AS amount,o.payout_ref FROM orders o JOIN listings l ON l.id=o.listing_id JOIN events e ON e.id=l.event_id
    WHERE l.seller_id=$1 AND o.settled_at IS NOT NULL ORDER BY o.settled_at DESC LIMIT 100`, [user.id])]);
  const mode = paymentMode();
  return <>
    <div className="page-heading"><h1>{t("seller.nav.payouts")}</h1><p>{t("seller.payoutsLead")}</p></div>
    <Notice t={t} error={params.error} success={params.success} />
    <div className="stat-grid two">
      <div className="stat gold"><Wallet size={20} /><span>{t("seller.stat.pending")}</span><strong>{money(summary.pending)}</strong><small>{t("seller.pendingHint")}</small></div>
      <div className="stat"><Landmark size={20} /><span>{t("seller.stat.paid")}</span><strong>{money(summary.paid)}</strong></div>
    </div>
    {mode === "stripe" ? <section className="panel callout"><div><h2>{t("seller.stripe.title")}</h2>
      <p>{user.stripe_ready ? t("seller.stripe.ready") : params.connect ? t("seller.stripe.check") : t("seller.stripe.todo")}</p></div>
      <div className="inline-form"><form action={onboarding}><button className="button outline">{t("seller.stripe.open")}</button></form>
      {user.stripe_account && <form action={refreshPayouts}><button className="button outline">{t("seller.stripe.status")}</button></form>}</div></section> :
    <form action={savePayout} className="panel form-stack"><h2><Landmark size={20} /> {t("seller.payout.title")}</h2>
      <p>{user.payout_account ? t("seller.payout.lead") : t("seller.payout.missing")}</p>
      <div className="form-columns three">
        <label>{t("seller.payout.bank")}<input name="bank" required minLength={2} maxLength={60} defaultValue={user.payout_bank ?? ""} placeholder="Maybank / TNG" /></label>
        <label>{t("seller.payout.name")}<input name="holder" required minLength={2} maxLength={80} defaultValue={user.payout_name ?? ""} /></label>
        <label>{t("seller.payout.account")}<input name="account" required minLength={4} maxLength={40} defaultValue={user.payout_account ?? ""} /></label>
      </div>
      <button className="button primary">{t("seller.payout.save")}</button>
    </form>}
    <section className="panel admin-panel"><h2>{t("seller.history")}</h2>
      {!history.length && <p className="muted">{t("seller.noHistory")}</p>}
      {history.map((row) => <div className="admin-row" key={row.id}><div><strong>{row.title}</strong><p>{f.date(row.settled_at)}{row.payout_ref && ` · ${row.payout_ref}`}</p></div>
        <strong className="row-total">{money(row.amount)}</strong></div>)}
    </section>
  </>;
}
