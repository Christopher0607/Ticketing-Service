import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";

// Runs against a second local server started with PAYMENT_MODE=manual (see README / CI).
const manualURL = process.env.MANUAL_BASE_URL;
const password = "CrazyMonkey2027!";
const dbUrl = process.env.DATABASE_URL ?? "postgresql://ticketing:ticketing@127.0.0.1:5442/ticketing";
if (!["localhost","127.0.0.1"].includes(new URL(dbUrl).hostname)) throw new Error("Use a local demo database for tests.");
if (manualURL && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(manualURL)) throw new Error("Manual-mode tests require a local server.");

const png = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();

async function signedIn(browser: Browser, email: string) {
  const context = await browser.newContext({ baseURL: manualURL, locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/account");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
  return page;
}

async function reserveAndUpload(buyer: Page, eventPath: string) {
  await buyer.goto(eventPath);
  await buyer.getByRole("button", { name: "Select tickets" }).click();
  await expect(buyer.getByRole("heading", { name: "Pay by DuitNow or bank transfer" })).toBeVisible();
  await expect(buyer.getByRole("timer")).toBeVisible();
  await buyer.getByLabel("Payment receipt (screenshot)").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: await png(500, 900, "#dff3e4") });
  await buyer.getByRole("button", { name: "Upload receipt" }).click();
  await expect(buyer.getByText("Receipt uploaded. We’ll verify your payment shortly.")).toBeVisible();
  await expect(buyer.getByText("Verifying payment", { exact: true }).first()).toBeVisible();
  return new URL(buyer.url()).pathname;
}

test("manual DuitNow payments: posters, markup cap, receipt review, payout and refund", async ({ browser }) => {
  test.skip(!manualURL, "Set MANUAL_BASE_URL to a server running with PAYMENT_MODE=manual.");
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  const label = `Manual QA ${Date.now()}`;
  let eventId: string | undefined;
  const original = (await db.query("SELECT buyer_bps,seller_bps,max_markup_bps FROM fee_settings")).rows[0];
  const [admin, seller, buyer] = await Promise.all(["admin", "seller", "buyer"].map((role) => signedIn(browser, `${role}@example.test`)));
  try {
    await db.query("UPDATE fee_settings SET buyer_bps=300,seller_bps=300");

    // Event with an uploaded poster, served immutably from /media.
    await admin.goto("/admin/events/new");
    await admin.getByLabel("Event name").fill(label);
    await admin.getByLabel("Venue", { exact: true }).fill("Test Hall");
    await admin.getByLabel("City").fill("Kuala Lumpur");
    await admin.getByLabel("Start (Malaysia time)").fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
    await admin.getByLabel("Description").fill("Manual payment automated fixture.");
    await admin.getByLabel("Official resale policy URL").fill("https://example.com/resale");
    await admin.getByLabel("Official transfer site").fill("https://example.com");
    await admin.getByLabel("Poster image").setInputFiles({ name: "poster.png", mimeType: "image/png", buffer: await png(900, 1200, "#d4af37") });
    await admin.getByRole("button", { name: "Publish event" }).click();
    await expect(admin.getByText("Event published.")).toBeVisible();
    const created = (await db.query("SELECT id,slug,poster_id FROM events WHERE title=$1", [label])).rows[0];
    eventId = created.id;
    expect(created.poster_id).toBeTruthy();
    // Served from Supabase Storage when configured (via redirect from /media), otherwise from the database.
    const poster = await admin.request.get(`/media/${created.poster_id}`);
    expect(poster.status()).toBe(200);
    expect(poster.headers()["content-type"]).toBe("image/webp");
    expect(poster.headers()["cache-control"]).toContain("31536000");
    const eventPath = `/events/${created.slug}`;
    await admin.goto(eventPath);
    const src = await admin.locator(".event-poster img").getAttribute("src");
    expect(src).toContain(created.poster_id);
    expect((await admin.request.get(src!)).status()).toBe(200);
    if (process.env.EXPECT_REMOTE_STORAGE === "true") {
      expect((await db.query("SELECT remote FROM media WHERE id=$1", [created.poster_id])).rows[0].remote).toBe(true);
      expect(src).toMatch(/^http:\/\/127\.0\.0\.1:54321\/storage\/v1\/object\/public\/media\//);
      expect((await db.query("SELECT receipt_path FROM orders WHERE listing_id IN (SELECT id FROM listings WHERE event_id=$1)", [eventId])).rowCount).toBe(0);
    }

    // Markup cap: 10% over face value.
    await admin.goto("/admin/settings");
    await admin.getByLabel("Max markup over face value (%)").fill("10");
    await admin.getByRole("button", { name: "Save rates" }).click();
    await expect(admin.getByText("Rates updated for new orders.")).toBeVisible();
    const list = async (price: string) => {
      await seller.goto("/sell/new");
      await seller.locator(".list-form").getByLabel("Event", { exact: true }).selectOption(eventId!);
      await seller.locator(".list-form").getByLabel("Seat or ticket section").fill("Manual Rock Zone");
      await seller.locator(".list-form").getByLabel("Face value per ticket (RM)").fill("100");
      await seller.locator(".list-form").getByLabel("Price per ticket (RM)").fill(price);
      await seller.locator(".list-form").getByLabel("Quantity", { exact: true }).fill("3");
      await seller.locator(".list-form").getByLabel("Proof of ticket ownership").fill("Provider order reference QA-1");
      await seller.getByRole("button", { name: "Submit for review" }).click();
    };
    await list("120");
    await expect(seller.locator(".notice.error")).toHaveText("The price is above the allowed markup over face value.");
    await list("110");
    await expect(seller.getByText("Listing sent for review.")).toBeVisible();
    await admin.goto("/admin/listings");
    await admin.locator(".admin-listing").filter({ hasText: label }).getByRole("button", { name: "Approve listing" }).click();
    await expect(admin.getByText("Listing updated.")).toBeVisible();
    await buyer.goto(eventPath);
    await expect(buyer.getByText("Face value RM100")).toBeVisible();
    await expect(buyer.getByText("+10% over face value")).toBeVisible();

    // Order 1: receipt is private, admin verifies, seller transfers, buyer confirms, admin pays out.
    const first = await reserveAndUpload(buyer, eventPath);
    if (process.env.EXPECT_REMOTE_STORAGE === "true") {
      const { rows: [stored] } = await db.query("SELECT receipt_path,receipt_file IS NULL AS no_file FROM orders WHERE id=$1", [first.split("/").at(-1)]);
      expect(stored.receipt_path).toMatch(/^receipts\//);
      expect(stored.no_file).toBe(true);
    }
    expect((await buyer.request.get(`/api${first}/receipt`)).status()).toBe(200);
    expect((await seller.request.get(`/api${first}/receipt`)).status()).toBe(404);
    expect((await db.query("SELECT available FROM listings WHERE event_id=$1", [eventId])).rows[0].available).toBe(2);
    await admin.goto(first);
    await expect(admin.getByRole("img", { name: "View receipt" })).toBeVisible();
    await admin.getByLabel("Bank reference (optional)").fill("MBB-778899");
    await admin.getByRole("button", { name: "Payment received" }).click();
    await expect(admin.getByText("Payment verified.")).toBeVisible();
    await buyer.reload();
    await expect(buyer.getByText("Awaiting transfer", { exact: true }).first()).toBeVisible();
    await seller.goto(first);
    await seller.getByLabel("Transfer reference").fill("QA-TRANSFER-1");
    await seller.getByRole("button", { name: "Record transfer" }).click();
    await expect(seller.getByText("Transfer recorded.")).toBeVisible();
    await buyer.reload();
    await buyer.getByRole("button", { name: "Confirm ticket received" }).click();
    await expect(buyer.getByText("Ticket receipt confirmed.").first()).toBeVisible();

    // Order 2: rejected receipt releases the tickets.
    const second = await reserveAndUpload(buyer, eventPath);
    await admin.goto(second);
    await admin.locator("summary", { hasText: "Reject payment" }).click();
    await admin.getByLabel("Reason for rejecting").fill("Amount not received");
    await admin.getByRole("button", { name: "Reject payment" }).click();
    await expect(admin.getByText("Payment rejected and tickets released.")).toBeVisible();
    await buyer.goto(second);
    await expect(buyer.getByText("Payment was not verified: Amount not received")).toBeVisible();
    expect((await db.query("SELECT available FROM listings WHERE event_id=$1", [eventId])).rows[0].available).toBe(2);

    // Order 3: verified, then refunded manually with a transfer reference.
    const third = await reserveAndUpload(buyer, eventPath);
    await admin.goto(third);
    await admin.getByRole("button", { name: "Payment received" }).click();
    await expect(admin.getByText("Payment verified.")).toBeVisible();
    await buyer.goto(third);
    await buyer.getByText("Request a refund", { exact: true }).click();
    await buyer.getByLabel("Reason").fill("Plans changed for this QA order.");
    await buyer.getByLabel("Refund account (bank and account number, or DuitNow ID)").fill("CIMB 7000 1111 22");
    await buyer.getByRole("button", { name: "Submit request" }).click();
    await expect(buyer.getByText("Refund request sent for review.")).toBeVisible();
    await admin.goto(third);
    await expect(admin.getByText("CIMB 7000 1111 22")).toBeVisible();
    await admin.getByRole("button", { name: "Approve refund" }).click();
    await expect(admin.locator(".notice.error")).toHaveText("Enter the refund transfer reference.");
    await admin.getByLabel("Refund transfer reference").fill("REFUND-123");
    await admin.getByRole("button", { name: "Approve refund" }).click();
    await expect(admin.getByText("Refund review saved.")).toBeVisible();
    await buyer.reload();
    await expect(buyer.getByText("Refunded", { exact: true }).first()).toBeVisible();

    // Payout for order 1 after the event.
    await db.query("UPDATE events SET starts_at=now()-interval '2 days' WHERE id=$1", [eventId]);
    await admin.goto(first);
    await expect(admin.getByText("Maybank · Stage Door Tickets · 5123 4567 8901")).toBeVisible();
    await admin.getByLabel("Payout transfer reference").fill("PAYOUT-555");
    await admin.getByRole("button", { name: "Settle seller proceeds" }).click();
    await expect(admin.getByText("Seller settlement recorded.")).toBeVisible();
    const { rows: [order] } = await db.query("SELECT payment_ref,payout_ref,settled_at FROM orders WHERE id=$1", [first.split("/").at(-1)]);
    expect(order).toMatchObject({ payment_ref: "MBB-778899", payout_ref: "PAYOUT-555" });
    expect(order.settled_at).toBeTruthy();
  } finally {
    if (eventId) {
      await db.query("DELETE FROM orders WHERE listing_id IN (SELECT id FROM listings WHERE event_id=$1)", [eventId]);
      await db.query("DELETE FROM listings WHERE event_id=$1", [eventId]);
      const { rows: [event] } = await db.query("DELETE FROM events WHERE id=$1 RETURNING poster_id", [eventId]);
      if (event?.poster_id) await db.query("DELETE FROM media WHERE id=$1", [event.poster_id]);
    }
    await db.query("UPDATE fee_settings SET buyer_bps=$1,seller_bps=$2,max_markup_bps=$3", [original.buyer_bps, original.seller_bps, original.max_markup_bps]);
    await db.end();
    await Promise.all([admin, seller, buyer].map((page) => page.context().close()));
  }
});
