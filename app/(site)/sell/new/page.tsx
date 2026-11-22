import { requireSeller } from "@/lib/auth";
import { percent } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { events, fees } from "@/lib/market";
import { createListing } from "@/app/actions";
import { PriceFields } from "@/app/client";
import { Notice, SupportLinks } from "@/app/ui";

export const metadata = { title: "New listing" };

export default async function NewListing({ searchParams }: { searchParams: Promise<{ error?: string; event?: string }> }) {
  const [, params, { t, f }, settings, catalogue] = await Promise.all([requireSeller("/sell/new"), searchParams, i18n(), fees(), events()]);
  const cap = settings.max_markup_bps;
  return <>
    <div className="page-heading"><h1>{t("seller.list.title")}</h1>
      <p>{t("seller.list.fee", { fee: percent(settings.seller_bps) })}{cap !== null && <> {cap === 0 ? t("seller.list.capFace") : t("seller.list.cap", { pct: percent(cap) })}</>}</p></div>
    <Notice t={t} error={params.error} />
    {catalogue.length ? <form className="panel form-stack list-form" action={createListing}>
      <label>{t("seller.list.event")}<select name="event" aria-label={t("seller.list.event")} required defaultValue={catalogue.some((item) => item.id === params.event) ? params.event : ""}>
        <option value="" disabled>{t("seller.list.choose")}</option>{catalogue.map((item) => <option key={item.id} value={item.id}>{item.title} · {f.date(item.starts_at)}</option>)}</select></label>
      <label>{t("seller.list.section")}<input name="section" required minLength={2} maxLength={80} placeholder={t("seller.list.sectionPh")} /></label>
      <PriceFields sellerBps={settings.seller_bps} buyerBps={settings.buyer_bps} capBps={cap}
        labels={{ face: t("seller.list.face"), price: t("seller.list.price"), buyerPays: t("home.fees.buyerPays"), youGet: t("seller.youGet"), overCap: t("err.overCap") }} />
      <label>{t("seller.list.quantity")}<input name="quantity" type="number" min={1} max={100} required defaultValue={1} /></label>
      <label>{t("seller.list.proof")}<textarea name="proof" required minLength={5} maxLength={1000} placeholder={t("seller.list.proofPh")} /></label>
      <label>{t("seller.list.file")}<input name="attachment" type="file" accept="application/pdf,image/png,image/jpeg" /></label>
      <small>{t("seller.list.fileHint")}</small>
      <button className="button primary">{t("seller.list.submit")}</button>
    </form> : <div className="panel"><p>{t("seller.list.noEvents")}</p></div>}
    <div className="panel help-strip"><small>{t("seller.list.missing")}</small><SupportLinks t={t} /></div>
  </>;
}
