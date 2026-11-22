"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Home, Search, Tag, UserRound } from "lucide-react";

export function LangSwitch({ to, label, title }: { to: "zh" | "en"; label: string; title: string }) {
  const pathname = usePathname();
  const href = `/lang?to=${to}&next=${encodeURIComponent(pathname)}`;
  return <a className="lang-switch" href={href} title={title} aria-label={title} lang={to === "zh" ? "zh" : "en"}
    onClick={(event) => {
      event.preventDefault();
      window.location.href = `/lang?to=${to}&next=${encodeURIComponent(pathname + window.location.search)}`;
    }}>{label}</a>;
}

export function TabBar({ labels, sellHref = "/sell" }: { labels: { home: string; explore: string; sell: string; account: string }; sellHref?: string }) {
  const pathname = usePathname();
  const tabs: [string, string, ReactNode][] = [
    ["/", labels.home, <Home key="h" size={21} />],
    ["/events", labels.explore, <Search key="s" size={21} />],
    [sellHref, labels.sell, <Tag key="t" size={21} />],
    ["/account", labels.account, <UserRound key="u" size={21} />],
  ];
  return <nav className="tabbar" aria-label={labels.home}>
    {tabs.map(([href, label, icon]) => {
      const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
      return <Link key={href} href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{icon}<span>{label}</span></Link>;
    })}
  </nav>;
}

/** Live mm:ss countdown to a reservation deadline. Refreshes the page when it reaches zero. */
export function Countdown({ until, label }: { until: number; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) {
        clearInterval(timer);
        window.location.reload();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  const left = Math.max(0, until - (now ?? until));
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  return <div className="countdown" role="timer" aria-label={label}>
    <span>{label}</span>
    <strong suppressHydrationWarning>{now === null ? "--:--" : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}</strong>
  </div>;
}

export function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="copy-button" aria-label={`${label}: ${value}`} onClick={async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked; the value is still visible */ }
  }}>{copied ? <Check size={15} /> : <Copy size={15} />}<span>{copied ? done : label}</span></button>;
}

export function PaymentRefresh({ text }: { text: string }) {
  const router = useRouter();
  useEffect(() => {
    let requests = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++requests >= 8) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [router]);
  return <p role="status">{text}</p>;
}
