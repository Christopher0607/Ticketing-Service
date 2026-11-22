import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

const password = "CrazyMonkey2027!";
const dbUrl = process.env.DATABASE_URL ?? "postgresql://ticketing:ticketing@127.0.0.1:5442/ticketing";
const safeDb = new URL(dbUrl);
if (!["localhost","127.0.0.1"].includes(safeDb.hostname)) throw new Error("Use a local demo database for tests.");

async function login(page: Page, email: string) {
  await page.goto("/account");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
}

test("mobile catalogue works without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText(/Local demo/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Real tickets/ })).toBeVisible();
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth === innerWidth);
  expect(await fits()).toBe(true);
  await page.getByRole("textbox", { name: /Search events/ }).fill("basketball");
  await page.getByRole("button", { name: "Search events" }).click();
  await expect(page.getByRole("heading", { name: "KL Basketball Finals" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "After Hours Live" })).toHaveCount(0);
  await page.getByRole("link", { name: /KL Basketball Finals/ }).click();
  await expect(page.getByRole("button", { name: "Select tickets" })).toBeVisible();
  expect(await fits()).toBe(true);
});

test("Chinese is the default for Chinese browsers and the language toggle remembers English", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, locale: "zh-CN" });
  const page = await context.newPage();
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "探索活动" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans-MY");
  await page.getByRole("link", { name: "切换语言" }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole("heading", { name: "Explore events" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Real tickets/ })).toBeVisible();
  await page.goto("/account?error=Call%20this%20number");
  await expect(page.locator(".notice.error")).toHaveText("We couldn’t complete that action. Please try again.");
  await expect(page.getByText("Call this number")).toHaveCount(0);
  await context.close();
});

test("admin, sellers and buyers can complete protected orders, refunds and settlement", async ({ browser, baseURL, page }) => {
  await page.goto("/");
  await expect(page.getByText(/Local demo/)).toBeVisible();
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  const contexts = await Promise.all([1, 2, 3, 4].map(() => browser.newContext({ baseURL })));
  const [admin, seller, buyer, rival] = await Promise.all(contexts.map((context) => context.newPage()));
  const label = `QA Concert ${Date.now()}`;
  let eventId: string | undefined;
  let rivalId: string | undefined;
  let originalFees: { buyer_bps: number; seller_bps: number } | undefined;
  try {
    originalFees = (await db.query("SELECT buyer_bps,seller_bps FROM fee_settings")).rows[0];
    await db.query("UPDATE fee_settings SET buyer_bps=300,seller_bps=300");
    await Promise.all([login(admin, "admin@example.test"), login(seller, "seller@example.test"), login(buyer, "buyer@example.test")]);
    const rivalEmail = `qa-${Date.now()}@example.test`;
    await rival.goto("/account?mode=register");
    await rival.getByLabel("Your name").fill("QA Buyer");
    await rival.getByLabel("Email address").fill(rivalEmail);
    await rival.getByLabel("Password", { exact: true }).fill(password);
    await rival.getByRole("checkbox", { name: /I have read and agree/ }).check();
    await rival.getByRole("button", { name: "Create account" }).click();
    await expect(rival.getByRole("heading", { name: "My account" })).toBeVisible();
    rivalId = (await db.query("SELECT id FROM users WHERE email=$1", [rivalEmail])).rows[0].id;

    await admin.goto("/admin?tab=events");
    await admin.getByLabel("Event name").fill(label);
    await admin.getByLabel("Venue", { exact: true }).fill("Test Hall");
    await admin.getByLabel("City").fill("Kuala Lumpur");
    await admin.getByLabel("Start (Malaysia time)").fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
    await admin.getByLabel("Description").fill("Local automated marketplace fixture.");
    await admin.getByLabel("Official resale policy URL").fill("https://example.com/resale");
    await admin.getByLabel("Official transfer site").fill("https://example.com");
    await admin.getByRole("button", { name: "Publish event" }).click();
    await expect(admin.getByRole("status").filter({ hasText: "Event published" })).toBeVisible();
    const created = (await db.query("SELECT id,slug FROM events WHERE title=$1", [label])).rows[0];
    eventId = created.id;
    const eventPath = `/events/${created.slug}`;

    await seller.goto("/sell");
    await seller.locator(".list-form").getByLabel("Event", { exact: true }).selectOption(eventId!);
    await seller.locator(".list-form").getByLabel("Seat or ticket section").fill("QA Balcony");
    await seller.locator(".list-form").getByLabel("Face value per ticket (RM)").fill("100");
    await seller.locator(".list-form").getByLabel("Price per ticket (RM)").fill("100");
    await seller.locator(".list-form").getByLabel("Proof of ticket ownership").fill("Private provider order example reference");
    await seller.locator(".list-form").getByLabel("Redacted proof file (optional)").setInputFiles({
      name: "redacted.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nQA test fixture"),
    });
    await seller.getByRole("button", { name: "Submit for review" }).click();
    await expect(seller.getByText("Listing sent for review.")).toBeVisible();
    await buyer.goto(eventPath);
    await expect(buyer.getByText("No tickets available")).toBeVisible();
    await admin.goto("/admin");
    const review = admin.locator(".admin-listing").filter({ hasText: label });
    await review.getByText("View ownership proof").click();
    const proof = (await review.getByRole("link", { name: "Download proof file" }).getAttribute("href"))!;
    expect((await buyer.request.get(proof)).status()).toBe(404);
    const proofResponse = await admin.request.get(proof);
    expect(proofResponse.status()).toBe(200);
    expect(proofResponse.headers()["content-disposition"]).toContain("attachment");
    await review.getByRole("button", { name: "Approve listing" }).click();
    await expect(admin.getByText("Listing updated.")).toBeVisible();

    await Promise.all([buyer.goto(eventPath), rival.goto(eventPath)]);
    await Promise.all([buyer, rival].map((participant) => participant.getByRole("button", { name: "Select tickets" }).click()));
    await expect.poll(() => [buyer.url(), rival.url()].filter((url) => url.includes("/orders/")).length).toBe(1);
    const winner = buyer.url().includes("/orders/") ? buyer : rival;
    const loser = winner === buyer ? rival : buyer;
    await expect(loser.getByRole("alert").filter({ hasText: "aren’t enough tickets" })).toContainText("aren’t enough tickets");
    const orderUrl = winner.url();
    await loser.goto(orderUrl);
    await expect(loser.getByText("This page is unavailable")).toBeVisible();
    await expect(winner.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await expect(winner.getByText("RM103", { exact: true })).toBeVisible();

    await admin.goto("/admin?tab=settings");
    await admin.getByLabel("Buyer fee (%)").fill("4.00");
    await admin.getByLabel("Seller fee (%)").fill("6.00");
    await admin.getByRole("button", { name: "Save rates" }).click();
    await expect(admin.getByText("Rates updated for new orders.")).toBeVisible();
    await winner.getByRole("button", { name: "Simulate payment" }).click();
    await expect(winner.getByText("Awaiting transfer", { exact: true })).toBeVisible();
    await seller.goto(orderUrl);
    await expect(seller.getByText("RM97", { exact: true })).toBeVisible();
    await seller.getByLabel("Transfer reference").fill("QA-REF-123");
    await seller.getByLabel("Official transfer link").fill("https://unapproved.example.com/ticket");
    await seller.getByRole("button", { name: "Record transfer" }).click();
    await expect(seller.getByRole("alert").filter({ hasText: "official transfer domain" })).toContainText("official transfer domain");
    await seller.getByLabel("Transfer reference").fill("QA-REF-123");
    await seller.getByLabel("Official transfer link").fill("https://example.com/ticket");
    await seller.getByRole("button", { name: "Record transfer" }).click();
    await expect(seller.getByText("Transfer recorded.")).toBeVisible();
    await winner.reload();
    await expect(winner.getByRole("link", { name: "Open official ticket transfer" })).toHaveAttribute("href", "https://example.com/ticket");
    await winner.getByRole("button", { name: "Confirm ticket received" }).click();
    await expect(winner.getByText("Ticket receipt confirmed.").first()).toBeVisible();

    await winner.getByText("Request a refund", { exact: true }).click();
    await winner.getByLabel("Reason").fill("Test request for an official ticket review.");
    await winner.getByRole("button", { name: "Submit request" }).click();
    await expect(winner.getByText("Refund request sent for review.")).toBeVisible();
    await admin.goto(orderUrl);
    await admin.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(admin.getByText("Refund review saved.")).toBeVisible();
    await expect(admin.getByRole("button", { name: "Settle seller proceeds" })).toBeDisabled();
    await db.query("UPDATE events SET starts_at=now()-interval '2 days' WHERE id=$1", [eventId]);
    await admin.reload();
    await admin.getByRole("button", { name: "Settle seller proceeds" }).click();
    await expect(admin.getByText("Seller settlement recorded.")).toBeVisible();
    const { rows: [order] } = await db.query("SELECT status,buyer_bps,seller_bps,settled_at FROM orders WHERE id=$1", [new URL(orderUrl).pathname.split("/").at(-1)]);
    expect(order).toMatchObject({ status: "confirmed", buyer_bps: 300, seller_bps: 300 });
    expect(order.settled_at).toBeTruthy();
  } finally {
    if (eventId) {
      await db.query("DELETE FROM orders WHERE listing_id IN (SELECT id FROM listings WHERE event_id=$1)", [eventId]);
      await db.query("DELETE FROM listings WHERE event_id=$1", [eventId]);
      await db.query("DELETE FROM events WHERE id=$1", [eventId]);
    }
    if (rivalId) await db.query("DELETE FROM users WHERE id=$1", [rivalId]);
    if (originalFees) await db.query("UPDATE fee_settings SET buyer_bps=$1,seller_bps=$2", [originalFees.buyer_bps, originalFees.seller_bps]);
    await db.end();
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("expired inventory returns to sale and an approved refund closes the paid order", async ({ browser, baseURL, page }) => {
  await page.goto("/");
  await expect(page.getByText(/Local demo/)).toBeVisible();
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  const [buyerContext, adminContext] = await Promise.all([1, 2].map(() => browser.newContext({ baseURL })));
  const [buyer, admin] = await Promise.all([buyerContext.newPage(), adminContext.newPage()]);
  const orderIds: string[] = [];
  let decremented = 0;
  let listingId: string | undefined;
  try {
    const [listing] = (await db.query(`SELECT l.id,l.available FROM listings l JOIN events e ON e.id=l.event_id
      WHERE e.slug='after-hours' ORDER BY l.created_at LIMIT 1`)).rows;
    listingId = listing.id;
    await Promise.all([login(buyer, "buyer@example.test"), login(admin, "admin@example.test")]);
    await buyer.goto("/events/after-hours");
    await buyer.getByRole("button", { name: "Select tickets" }).first().click();
    await expect(buyer.getByRole("heading", { name: "Checkout" })).toBeVisible();
    orderIds.push(new URL(buyer.url()).pathname.split("/").at(-1)!);
    decremented++;
    await db.query("UPDATE orders SET expires_at=now()-interval '1 minute' WHERE id=$1", [orderIds[0]]);
    expect((await page.request.post("/api/jobs/reconcile")).status()).toBe(401);
    const job = await page.request.post("/api/jobs/reconcile", {
      headers: { authorization: `Bearer ${process.env.JOB_SECRET || "local-demo-reconcile"}` },
    });
    expect(job.status()).toBe(200);
    expect(await job.json()).toMatchObject({ failures: 0 });
    const restored = (await db.query("SELECT available FROM listings WHERE id=$1", [listingId])).rows[0];
    expect(restored.available).toBe(listing.available);
    decremented--;
    await buyer.reload();
    await expect(buyer.getByRole("link", { name: "Return to event" })).toBeVisible();

    await buyer.getByRole("link", { name: "Return to event" }).click();
    await buyer.getByRole("button", { name: "Select tickets" }).first().click();
    await expect(buyer.getByRole("heading", { name: "Checkout" })).toBeVisible();
    orderIds.push(new URL(buyer.url()).pathname.split("/").at(-1)!);
    decremented++;
    await buyer.getByRole("button", { name: "Cancel reservation" }).click();
    await expect(buyer.getByText("Reservation cancelled. The tickets are available again.")).toBeVisible();
    decremented--;
    expect((await db.query("SELECT available FROM listings WHERE id=$1", [listingId])).rows[0].available).toBe(listing.available);
    await buyer.getByRole("link", { name: "Return to event" }).click();
    await buyer.getByRole("button", { name: "Select tickets" }).first().click();
    await expect(buyer.getByRole("heading", { name: "Checkout" })).toBeVisible();
    orderIds.push(new URL(buyer.url()).pathname.split("/").at(-1)!);
    decremented++;
    await buyer.getByRole("button", { name: "Simulate payment" }).click();
    await expect(buyer.getByText("Awaiting transfer", { exact: true })).toBeVisible();
    await buyer.getByText("Request a refund", { exact: true }).click();
    await buyer.getByLabel("Reason").fill("No ticket transfer was possible for this test.");
    await buyer.getByRole("button", { name: "Submit request" }).click();
    await expect(buyer.getByText("Refund request sent for review.")).toBeVisible();
    await admin.goto(buyer.url());
    await admin.getByRole("button", { name: "Approve refund" }).click();
    await expect(admin.getByText("Refund review saved.")).toBeVisible();
    await buyer.reload();
    await expect(buyer.getByText("Refunded", { exact: true }).first()).toBeVisible();
  } finally {
    await db.query("DELETE FROM orders WHERE id=ANY($1::uuid[])", [orderIds]);
    if (listingId && decremented) await db.query("UPDATE listings SET available=available+$2 WHERE id=$1", [listingId, decremented]);
    await db.end();
    await Promise.all([buyerContext.close(), adminContext.close()]);
  }
});
