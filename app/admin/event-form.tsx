import { categories, posterUrl } from "@/lib/format";
import type { Translate } from "@/lib/i18n";
import type { Event } from "@/lib/market";
import { categoryLabel } from "../ui";

type Defaults = Pick<Event, "id" | "title" | "category" | "venue" | "city" | "starts_at" | "description" | "transfer_policy_url" | "transfer_host" | "featured" | "image" | "poster_id">;

/** Malaysia has no daylight saving, so UTC+8 is exact for datetime-local inputs. */
const malaysiaLocal = (value: Date) => new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 16);

export function EventForm({ t, action, item }: { t: Translate; action: (form: FormData) => Promise<void>; item?: Defaults }) {
  return <form action={action} className="form-stack">
    {item && <input type="hidden" name="id" value={item.id} />}
    <label>{t("admin.ev.title")}<input name="title" required minLength={3} maxLength={100} defaultValue={item?.title} /></label>
    <label>{t("admin.ev.category")}<select name="category" defaultValue={item?.category}>{categories.map((category) => <option key={category} value={category}>{categoryLabel(t, category)}</option>)}</select></label>
    <div className="form-columns"><label>{t("admin.ev.venue")}<input name="venue" required maxLength={100} defaultValue={item?.venue} /></label>
      <label>{t("admin.ev.city")}<input name="city" required maxLength={80} defaultValue={item?.city} /></label></div>
    <label>{t("admin.ev.start")}<input type="datetime-local" name="start" required defaultValue={item ? malaysiaLocal(item.starts_at) : undefined} /></label>
    <label>{t("admin.ev.description")}<textarea name="description" required minLength={10} maxLength={1500} defaultValue={item?.description} /></label>
    <label>{t("admin.ev.policy")}<input name="policy" type="url" required maxLength={1500} defaultValue={item?.transfer_policy_url ?? undefined} /></label>
    <label>{t("admin.ev.transfer")}<input name="transfer site" type="url" required maxLength={1500} defaultValue={item?.transfer_host ? `https://${item.transfer_host}` : undefined} /></label>
    <div className="poster-field">
      {item && <img src={posterUrl(item)} alt="" className="poster-preview" />}
      <label>{t("admin.ev.poster")}<input name="poster" type="file" accept="image/jpeg,image/png,image/webp" /></label>
      <small>{t("admin.ev.posterHint")}</small>
    </div>
    <label className="check-label"><input type="checkbox" name="featured" defaultChecked={item?.featured} /> {t("admin.ev.featured")}</label>
    <button className="button primary">{item ? t("admin.ev.save") : t("admin.ev.publishBtn")}</button>
  </form>;
}
