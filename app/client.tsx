"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, CheckCircle2, Copy, Home, Search, Tag, Upload, UploadCloud, UserRound, X } from "lucide-react";

export function LangSwitch({ to, label, title }: { to: "zh" | "en"; label: string; title: string }) {
  const pathname = usePathname();
  const href = `/lang?to=${to}&next=${encodeURIComponent(pathname)}`;
  return <a className="lang-switch" href={href} title={title} aria-label={`${label} · ${title}`} lang={to === "zh" ? "zh" : "en"}
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

export type Slide = { href: string; title: string; poster: string; kicker: string; meta: string[]; price: string | null; cta: string };

/** Auto-advancing spotlight carousel (pauses on hover/focus, swipeable on phones). */
export function HeroCarousel({ slides, label, previous, next }: { slides: Slide[]; label: string; previous: string; next: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touch, setTouch] = useState<number | null>(null);
  const count = slides.length;
  const go = (step: number) => setIndex((current) => (current + step + count) % count);
  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [paused, count]);
  return <section className="carousel" aria-roledescription="carousel" aria-label={label}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
    onTouchStart={(event) => setTouch(event.touches[0].clientX)}
    onTouchEnd={(event) => { if (touch !== null) { const dx = event.changedTouches[0].clientX - touch; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } setTouch(null); }}>
    <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
      {slides.map((slide, i) => <article className="slide" key={slide.href} aria-roledescription="slide" aria-label={`${i + 1} / ${count}`} aria-hidden={i !== index}>
        <div className="slide-bg" aria-hidden="true"><img src={slide.poster} alt="" /></div>
        <div className="shell slide-inner">
          <div className="slide-copy">
            <span className="featured-label">{slide.kicker}</span>
            <h2>{slide.title}</h2>
            <ul className="slide-meta">{slide.meta.map((item) => <li key={item}>{item}</li>)}</ul>
            {slide.price && <p className="slide-price">{slide.price}</p>}
            <Link className="button primary" href={slide.href} tabIndex={i === index ? 0 : -1}>{slide.cta}</Link>
          </div>
          <Link className="slide-poster" href={slide.href} tabIndex={-1}><img src={slide.poster} alt={slide.title} /></Link>
        </div>
      </article>)}
    </div>
    {count > 1 && <>
      <button type="button" className="carousel-arrow prev" aria-label={previous} onClick={() => go(-1)}>‹</button>
      <button type="button" className="carousel-arrow next" aria-label={next} onClick={() => go(1)}>›</button>
      <div className="carousel-dots">{slides.map((slide, i) => <button key={slide.href} type="button" aria-label={`${i + 1} / ${count}`}
        aria-current={i === index} className={i === index ? "active" : undefined} onClick={() => setIndex(i)} />)}</div>
    </>}
  </section>;
}

/**
 * File input for photos. Large images are resized and re-encoded in the browser before upload,
 * which keeps uploads fast on mobile data and under serverless request limits (about 6 MB on Netlify).
 */
export function ImageField({ name, label, hint, required, preview, compress = true, maxSide = 2000 }: {
  name: string; label: string; hint?: string; required?: boolean; preview?: string | null; compress?: boolean; maxSide?: number;
}) {
  const [url, setUrl] = useState<string | null>(preview ?? null);
  return <label className="image-field">{label}
    <input type="file" name={name} accept="image/jpeg,image/png,image/webp" required={required} onChange={async (event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      setUrl(URL.createObjectURL(file));
      if (!compress || file.size < 900_000 || typeof createImageBitmap !== "function") return;
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
        if (!blob || blob.size >= file.size) return;
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        input.files = transfer.files;
      } catch { /* keep the original file */ }
    }} />
    {url && <img className="image-preview" src={url} alt="" />}
    {hint && <small>{hint}</small>}
  </label>;
}

export type SideNavItem = { href: string; label: string; icon: ReactNode; badge?: number; exact?: boolean };

/** Sidebar navigation for the admin console and seller centre (a scrolling tab row on phones). */
export function SideNav({ items, label }: { items: SideNavItem[]; label: string }) {
  const pathname = usePathname();
  return <nav className="side-nav" aria-label={label}>
    {items.map((item) => {
      const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
        {item.icon}<span>{item.label}</span>{item.badge ? <span className="side-badge">{item.badge}</span> : null}
      </Link>;
    })}
  </nav>;
}

/** Face value and price inputs with a live preview of what the buyer pays and the seller receives. */
export function PriceFields({ sellerBps, capBps, labels }: {
  sellerBps: number; capBps: number | null;
  labels: { face: string; price: string; platformFee: string; youGet: string; overCap: string };
}) {
  const [face, setFace] = useState("");
  const [price, setPrice] = useState("");
  const toSen = (value: string) => (/^\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : null);
  const fee = (sen: number, bps: number) => Math.floor((sen * bps + 5000) / 10000);
  const rm = (sen: number) => `RM${(sen / 100).toFixed(sen % 100 ? 2 : 0)}`;
  const faceSen = toSen(face);
  const priceSen = toSen(price);
  const overCap = capBps !== null && faceSen !== null && priceSen !== null && priceSen > faceSen + Math.floor((faceSen * capBps) / 10000);
  return <>
    <div className="form-columns">
      <label>{labels.face}<input name="face" type="number" min={1} max={25000} step=".01" required inputMode="decimal" value={face} onChange={(event) => setFace(event.target.value)} /></label>
      <label>{labels.price}<input name="price" type="number" min={2} max={25000} step=".01" required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
    </div>
    {priceSen !== null && priceSen > 0 && <div className={overCap ? "price-preview over" : "price-preview"} aria-live="polite">
      <span>{labels.youGet} <strong>{rm(priceSen - fee(priceSen, sellerBps))}</strong></span>
      <small className="fee-note">{labels.platformFee.replace("{amount}", rm(fee(priceSen, sellerBps)))}</small>
      {overCap && <em>{labels.overCap}</em>}
    </div>}
  </>;
}

async function compressPhoto(file: File, maxSide: number) {
  if (file.size < 900_000 || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

function UploadButton({ label, busyLabel, busy }: { label: string; busyLabel: string; busy: boolean }) {
  const { pending } = useFormStatus();
  return <button className="button primary" disabled={pending || busy}><Upload size={17} /> {pending || busy ? busyLabel : label}</button>;
}

/** Tap-to-upload payment screenshot with preview (compressed in the browser), like the group-buy site. */
export function ReceiptUploader({ labels }: { labels: { field: string; choose: string; hint: string; selected: string; remove: string; upload: string; uploading: string; tooBig: string } }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clear = () => { setPreview(null); setError(null); if (input.current) input.current.value = ""; };
  return <div className="receipt-uploader">
    <input ref={input} className="sr-only" type="file" name="receipt" accept="image/jpeg,image/png,image/webp" required aria-label={labels.field}
      onChange={async (event) => {
        const field = event.currentTarget;
        const file = field.files?.[0];
        setError(null);
        if (!file) return clear();
        if (file.size > 8 * 1024 * 1024) { setError(labels.tooBig); field.value = ""; setPreview(null); return; }
        setPreview(URL.createObjectURL(file));
        setBusy(true);
        const smaller = await compressPhoto(file, 1800);
        if (smaller !== file) { const transfer = new DataTransfer(); transfer.items.add(smaller); field.files = transfer.files; }
        setBusy(false);
      }} />
    {!preview ? <button type="button" className="dropzone" onClick={() => input.current?.click()}>
      <UploadCloud size={36} /><strong>{labels.choose}</strong><small>{labels.hint}</small>
    </button> : <div className="receipt-preview-box">
      <img src={preview} alt={labels.field} />
      <button type="button" className="receipt-clear" onClick={clear} aria-label={labels.remove}><X size={16} /></button>
      <p><CheckCircle2 size={16} /> {labels.selected}</p>
    </div>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {preview && <UploadButton label={labels.upload} busyLabel={labels.uploading} busy={busy} />}
  </div>;
}
