"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="shell page"><div className="empty" role="alert"><h2>We couldn’t load this page</h2><p>Try loading the page again.</p><button className="button primary" onClick={reset}>Try again</button></div></div>;
}
