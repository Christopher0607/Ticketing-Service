import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { uuid } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { remoteFlags, type Event } from "@/lib/market";
import { updateEvent } from "@/app/actions";
import { Notice } from "@/app/ui";
import { EventForm } from "@/app/admin/event-form";

export const metadata = { title: "Edit event" };

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, notice, { t }] = await Promise.all([params, searchParams, i18n()]);
  if (!uuid.test(id)) notFound();
  await requireAdmin(`/admin/events/${id}`);
  const [item] = await query<Event>(`SELECT e.*, ${remoteFlags} FROM events e WHERE e.id=$1`, [id]);
  if (!item) notFound();
  return <div className="narrow">
    <Link className="back-link" href="/admin/events"><ChevronLeft size={18} /> {t("admin.tab.events")}</Link>
    <div className="page-heading"><h1>{t("admin.editTitle")}</h1><p>{item.title}</p></div>
    <Notice t={t} {...notice} />
    <section className="panel admin-panel"><EventForm t={t} action={updateEvent} item={item} /></section>
  </div>;
}
