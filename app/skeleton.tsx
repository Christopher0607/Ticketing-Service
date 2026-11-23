/** Instant placeholders shown while a page loads (no data, no cookies, so they can be prefetched). */
export function PageSkeleton({ cards = 6, variant = "grid" }: { cards?: number; variant?: "grid" | "rows" | "detail" }) {
  return <div className="shell page skeleton-page" role="status" aria-live="polite" aria-label="加载中 · Loading">
    <div className="skeleton-heading"><span className="skeleton sk-title" /><span className="skeleton sk-line" /></div>
    {variant === "detail" ? <div className="skeleton-detail"><span className="skeleton sk-poster" />
      <div className="skeleton-stack">{Array.from({ length: 5 }, (_, i) => <span key={i} className="skeleton sk-row" />)}</div></div>
      : variant === "rows" ? <div className="skeleton-stack">{Array.from({ length: cards }, (_, i) => <span key={i} className="skeleton sk-row" />)}</div>
      : <div className="skeleton-grid">{Array.from({ length: cards }, (_, i) => <span key={i} className="skeleton sk-card" />)}</div>}
  </div>;
}
