// Runs every 5 minutes on Netlify.
// - Once an hour: the safety-net job (releases stale reservations, cleans expired sessions, checks
//   Stripe payments; reservations are also released on page loads).
// - Otherwise: a light health check that keeps the website's server warm with an open database
//   connection, so visitors don't wait for a cold start. It also keeps the free Supabase project active.
// Cost on the free plan is roughly 15 credits a month.
export default async () => {
  const base = process.env.APP_URL;
  const secret = process.env.JOB_SECRET;
  if (!base || !secret) {
    console.error("Set APP_URL and JOB_SECRET to run reconciliation.");
    return;
  }
  const hourly = new Date().getUTCMinutes() < 5;
  const response = await fetch(new URL(hourly ? "/api/jobs/reconcile" : "/api/health", base), {
    method: hourly ? "POST" : "GET",
    headers: hourly ? { Authorization: `Bearer ${secret}` } : {},
    signal: AbortSignal.timeout(20000),
  });
  console.log(hourly ? "reconcile" : "keep-warm", response.status, hourly ? await response.text() : "");
};

export const config = { schedule: "*/5 * * * *" };
