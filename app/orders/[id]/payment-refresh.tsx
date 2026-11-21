"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PaymentRefresh() {
  const router = useRouter();
  useEffect(() => {
    let requests = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++requests >= 8) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [router]);
  return <p role="status">Waiting for Stripe to confirm your payment. This page updates automatically.</p>;
}
