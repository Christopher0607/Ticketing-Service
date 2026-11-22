"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="shell page"><div className="empty" role="alert">
    <h2>页面加载失败 · We couldn’t load this page</h2>
    <p>请重试 · Please try again.</p>
    <button className="button primary" onClick={reset}>重试 · Try again</button>
  </div></div>;
}
