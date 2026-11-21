import { timingSafeEqual } from "node:crypto";
import { paymentMode } from "@/lib/config";
import { reconcile } from "@/lib/stripe";

export async function POST(request: Request) {
  const secret = process.env.JOB_SECRET;
  const authorization = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || (paymentMode() !== "demo" && secret.length < 32) || authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await reconcile());
}
