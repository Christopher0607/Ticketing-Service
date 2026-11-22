import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { uuid } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import type { Event } from "@/lib/market";
import { updateEvent } from "../../../actions";
import { Notice } from "../../../ui";
import { EventForm } from "../../event-form";

export const metadata = { title: "Edit event" };

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, notice, { t }] = await Promise.all([params, searchParams, i18n()]);
  if (!uuid.test(id)) notFound();
  await requireUser(`/admin`, "admin");
  const [item] = await query<Event>("SELECT * FROM events WHERE id=$1", [id]);
  if (!item) notFound();
  return <div className="shell page narrow">
    <Link className="back-link" href="/admin?tab=events"><ChevronLeft size={18} /> {t("admin.title")}</Link>
    <div className="page-heading"><h1>{t("admin.editTitle")}</h1><p>{item.title}</p></div>
    <Notice t={t} {...notice} />
    <section className="panel admin-panel"><EventForm t={t} action={updateEvent} item={item} /></section>
  </div>;
}
