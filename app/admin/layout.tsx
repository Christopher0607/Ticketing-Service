import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { site, databaseConfigured } from "@/lib/config";
import { i18n } from "@/lib/i18n";
import { SetupPending } from "@/app/ui";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

/** Admin console root. With ADMIN_HOST set, the console is only reachable on that domain. */
export default async function AdminRoot({ children }: Readonly<{ children: React.ReactNode }>) {
  const [{ t }, head] = await Promise.all([i18n(), headers()]);
  const adminHost = site.adminHost();
  if (adminHost && head.get("host")?.toLowerCase() !== adminHost) notFound();
  if (!databaseConfigured()) return <SetupPending t={t} />;
  return <div className="console-root">{children}</div>;
}
