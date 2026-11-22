// Hourly safety net on Netlify: releases stale reservations, cleans expired sessions and checks
// Stripe payments. Reservations are also released on page loads, so this does not need to run often.
// It also keeps the free Supabase project active.
export default async () => {
  const base = process.env.APP_URL;
  const secret = process.env.JOB_SECRET;
  if (!base || !secret) {
    console.error("Set APP_URL and JOB_SECRET to run reconciliation.");
    return;
  }
  const response = await fetch(new URL("/api/jobs/reconcile", base), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20000),
  });
  console.log("reconcile", response.status, await response.text());
};

export const config = { schedule: "@hourly" };
