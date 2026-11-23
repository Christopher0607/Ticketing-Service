import { CheckCircle2, CircleAlert, Percent, QrCode, ServerCog } from "lucide-react";
import { paymentMode } from "@/lib/config";
import { mediaUrl } from "@/lib/format";
import { mailConfigured } from "@/lib/identity";
import { i18n } from "@/lib/i18n";
import { fees, paymentConfigured, paymentSettings } from "@/lib/market";
import { remoteStorage } from "@/lib/storage";
import { savePaymentSettings, updateFees } from "@/app/actions";
import { ImageField } from "@/app/client";
import { Notice } from "@/app/ui";

export const metadata = { title: "Settings" };

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [params, { t }, settings, pay] = await Promise.all([searchParams, i18n(), fees(), paymentSettings()]);
  const mode = paymentMode();
  const checks: [boolean, string][] = [
    [Boolean(mode), t("admin.mode", { mode: mode ? t(`mode.${mode}`) : t("admin.modeNone") })],
    [paymentConfigured(pay), t("console.check.payment")],
    [remoteStorage(), remoteStorage() ? t("console.check.storageRemote") : t("console.check.storageDb")],
    [mailConfigured(), mailConfigured() ? t("console.check.mail") : t("console.check.noMail")],
    [process.env.LEGAL_REVIEWED === "true", t("console.check.legal")],
    [Boolean(process.env.COMPANY_NAME), t("console.check.company")],
  ];
  return <>
    <div className="page-heading"><h1>{t("admin.tab.settings")}</h1><p>{t("console.settingsLead")}</p></div>
    <Notice t={t} error={params.error} success={params.success} />
    <section className="panel admin-panel status-list"><h2><ServerCog size={20} /> {t("console.status")}</h2>
      <ul>{checks.map(([ok, label]) => <li key={label} className={ok ? "ok" : "todo"}>{ok ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />} {label}</li>)}</ul></section>
    <div className="admin-grid">
      <section className="panel admin-panel"><h2><Percent size={20} /> {t("admin.fees")}</h2><p className="muted">{t("admin.feesLead")}</p>
        <form action={updateFees} className="form-stack"><div className="form-columns"><label>{t("admin.buyerFee")}<input name="buyer fee" type="number" min={0} max={30} step=".01" required defaultValue={settings.buyer_bps / 100} /></label>
          <label>{t("admin.sellerFee")}<input name="seller fee" type="number" min={0} max={30} step=".01" required defaultValue={settings.seller_bps / 100} /></label></div>
          <label>{t("admin.maxMarkup")}<input name="max markup" type="number" min={0} max={1000} step=".01" defaultValue={settings.max_markup_bps === null ? "" : settings.max_markup_bps / 100} /></label>
          <small>{t("admin.maxMarkupHint")}</small>
          <button className="button primary">{t("admin.saveRates")}</button></form>
      </section>
      <section className="panel admin-panel"><h2><QrCode size={20} /> {t("admin.payment")}</h2>
        <p className="muted">{t("admin.paymentLead")}</p>
        <form action={savePaymentSettings} className="form-stack">
          <div className="form-columns"><label>{t("pay.bank")}<input name="bank" maxLength={60} defaultValue={pay.bank_name ?? ""} placeholder="Maybank" /></label>
            <label>{t("pay.accountName")}<input name="holder" maxLength={80} defaultValue={pay.account_name ?? ""} /></label></div>
          <div className="form-columns"><label>{t("pay.accountNumber")}<input name="account" maxLength={40} defaultValue={pay.account_number ?? ""} /></label>
            <label>{t("pay.duitnow")}<input name="duitnow" maxLength={60} defaultValue={pay.duitnow_id ?? ""} /></label></div>
          <div className="qr-field">
            <ImageField name="qr" label={t("admin.qr")} hint={t("admin.qrHint")} preview={pay.qr_id ? mediaUrl(pay.qr_id, pay.qr_remote) : null} compress={false} />
            {pay.qr_id && <label className="check-label"><input type="checkbox" name="remove qr" /> {t("admin.removeQr")}</label>}
          </div>
          <label>{t("admin.note")}<textarea name="note" maxLength={300} defaultValue={pay.note ?? ""} /></label>
          <button className="button primary">{t("admin.savePayment")}</button>
        </form>
      </section>
    </div>
  </>;
}
