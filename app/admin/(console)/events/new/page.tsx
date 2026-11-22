import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { i18n } from "@/lib/i18n";
import { createEvent } from "@/app/actions";
import { EventForm } from "@/app/admin/event-form";
import { Notice } from "@/app/ui";

export const metadata = { title: "New event" };

export default async function NewEvent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [params, { t }] = await Promise.all([searchParams, i18n()]);
  return <div className="narrow">
    <Link className="back-link" href="/admin/events"><ChevronLeft size={18} /> {t("admin.tab.events")}</Link>
    <div className="page-heading"><h1>{t("admin.publish")}</h1><p>{t("admin.publishLead")}</p></div>
    <Notice t={t} error={params.error} />
    <section className="panel admin-panel"><EventForm t={t} action={createEvent} /></section>
  </div>;
}
