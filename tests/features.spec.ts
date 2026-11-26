import { expect, test, type Browser } from "@playwright/test";
import pg from "pg";

const password = "CrazyMonkey2027!";
const dbUrl = process.env.DATABASE_URL ?? "postgresql://ticketing:ticketing@127.0.0.1:5442/ticketing";
if (!["localhost","127.0.0.1"].includes(new URL(dbUrl).hostname)) throw new Error("Use a local demo database for tests.");

async function signedIn(browser: Browser, baseURL: string | undefined, email: string) {
  const context = await browser.newContext({ baseURL, locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/account");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
  return page;
}

test("discovery: filters, sorting, seller profiles, structured data, legal pages and sitemap", async ({ page }) => {
  await page.goto("/events?city=George%20Town");
  await expect(page.getByRole("heading", { name: "Penang Jazz Weekend" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Neon Nights KL" })).toHaveCount(0);

  await page.goto("/events?sort=price");
  const prices = (await page.locator(".event-card .stub .price").allTextContents()).map((text) => Number(text.replace(/[^\d.]/g, "")));
  expect(prices.length).toBeGreaterThan(3);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));

  await page.goto("/events/midnight-echoes");
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(data).toMatchObject({ "@type": "Event", name: "Midnight Echoes Asia Tour", offers: { "@type": "AggregateOffer", priceCurrency: "MYR" } });
  await expect(page.locator(".listing")).toHaveCount(3);
  await page.goto("/events/midnight-echoes?qty=7");
  await expect(page.locator(".listing")).toHaveCount(1);
  await expect(page.locator(".listing").getByRole("heading", { name: "Level 3 Seated" })).toBeVisible();
  await page.goto("/events/midnight-echoes?sort=desc");
  await expect(page.locator(".listing").first().getByRole("heading")).toHaveText("Rock Zone A");
  await expect(page.getByRole("link", { name: "Waze" })).toHaveAttribute("href", /waze\.com\/ul\?q=Axiata%20Arena/);

  await page.locator(".listing").first().getByRole("link", { name: /Ah Meng Tickets/ }).click();
  await expect(page.getByRole("heading", { name: "Ah Meng Tickets" })).toBeVisible();
  await expect(page.getByText("Smooth, would buy again.")).toBeVisible();
  await expect(page.getByText("4.7")).toBeVisible();

  await page.goto("/legal/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeVisible();
  await expect(page.getByText("Draft pending legal review.")).toBeVisible();
  await expect(page.getByText(/currently 3% of the ticket price/).first()).toBeVisible();
  await page.goto("/legal/refunds");
  await expect(page.getByRole("heading", { name: "Refund & Buyer Guarantee Policy", level: 1 })).toBeVisible();
  await page.goto("/legal/privacy");
  await expect(page.getByRole("heading", { name: /Personal data we collect/ })).toBeVisible();
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About Crazy Monkey" })).toBeVisible();

  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/events/midnight-echoes");
  expect(await (await page.request.get("/robots.txt")).text()).toContain("Disallow: /admin");
});

test("accounts: consent, saved events, profile, seller edits, CSV export and suspension", async ({ browser, baseURL }) => {
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  const email = `fan-${Date.now()}@example.test`;
  const context = await browser.newContext({ baseURL, locale: "en-US" });
  const fan = await context.newPage();
  const { rows: [comedy] } = await db.query("SELECT l.id,l.price FROM listings l JOIN events e ON e.id=l.event_id WHERE e.slug='comedy-night-live' LIMIT 1");
  const [seller, admin] = await Promise.all([signedIn(browser, baseURL, "seller@example.test"), signedIn(browser, baseURL, "admin@example.test")]);
  try {
    await fan.goto("/account?mode=register");
    await expect(fan.getByRole("checkbox", { name: /I have read and agree/ })).toHaveAttribute("required", "");
    await fan.getByLabel("Your name").fill("Saved Fan");
    await fan.getByLabel("Email address").fill(email);
    await fan.getByLabel("Password", { exact: true }).fill(password);
    await fan.getByRole("checkbox", { name: /I have read and agree/ }).check();
    await fan.getByRole("button", { name: "Create account" }).click();
    await expect(fan.getByRole("heading", { name: "My account" })).toBeVisible();
    expect((await db.query("SELECT terms_accepted_at FROM users WHERE email=$1", [email])).rows[0].terms_accepted_at).toBeTruthy();

    await fan.goto("/events/penang-jazz-weekend");
    await fan.getByRole("button", { name: "Save", exact: true }).click();
    await expect(fan.getByRole("button", { name: "Saved" })).toBeVisible();
    await fan.goto("/account?tab=favorites");
    await expect(fan.getByRole("heading", { name: "Penang Jazz Weekend" })).toBeVisible();
    await fan.goto("/account?tab=profile");
    await fan.getByLabel("Your name").fill("Saved Fan Updated");
    await fan.getByRole("button", { name: "Save profile" }).click();
    await expect(fan.getByText("Profile saved.")).toBeVisible();

    await seller.goto("/sell");
    await expect(seller.getByText("Live listings")).toBeVisible();
    await seller.goto("/sell/listings");
    const row = seller.locator(".dashboard-row").filter({ hasText: "Comedy Night Live" });
    await row.getByText("Edit", { exact: true }).click();
    await row.getByLabel("Price per ticket (RM)").fill("90");
    await row.getByRole("button", { name: "Save listing" }).click();
    await expect(seller.getByText("Listing updated.")).toBeVisible();
    expect((await db.query("SELECT price FROM listings WHERE id=$1", [comedy.id])).rows[0].price).toBe(9000);

    const csv = await admin.request.get("/api/admin/orders.csv?from=2020-01-01&to=2099-12-31");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("order_id,created_myt,paid_myt");
    expect((await fan.request.get("/api/admin/orders.csv?from=2020-01-01&to=2099-12-31")).status()).toBe(404);

    await admin.goto(`/admin/users?q=${encodeURIComponent(email)}`);
    await admin.locator(".admin-row").filter({ hasText: email }).getByRole("button", { name: "Suspend" }).click();
    await expect(admin.getByText("User updated.")).toBeVisible();
    await fan.goto("/account");
    await expect(fan.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await fan.getByLabel("Email address").fill(email);
    await fan.getByLabel("Password", { exact: true }).fill(password);
    await fan.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(fan.locator(".notice.error")).toHaveText("This account has been suspended. Please contact support.");
  } finally {
    await db.query("UPDATE listings SET price=$2 WHERE id=$1", [comedy.id, comedy.price]);
    await db.query("DELETE FROM users WHERE email=$1", [email]);
    await db.end();
    await Promise.all([context.close(), seller.context().close(), admin.context().close()]);
  }
});

test("buyers can review a seller once after confirming receipt", async ({ browser, baseURL }) => {
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  const buyer = await signedIn(browser, baseURL, "buyer@example.test");
  let orderId: string | undefined;
  try {
    const { rows: [order] } = await db.query(`INSERT INTO orders (listing_id,buyer_id,quantity,subtotal,buyer_bps,seller_bps,buyer_fee,seller_fee,payment_mode,status,expires_at,paid_at,delivered_at,transfer_ref)
      SELECT l.id,u.id,1,l.price,300,300,0,0,'demo','confirmed',now(),now(),now(),'REVIEW-QA' FROM listings l JOIN events e ON e.id=l.event_id
      CROSS JOIN users u WHERE e.slug='silk-road-musical' AND u.email='buyer@example.test' LIMIT 1 RETURNING id`);
    orderId = order.id;
    await buyer.goto(`/orders/${orderId}`);
    await expect(buyer.getByRole("heading", { name: "Rate this seller" })).toBeVisible();
    await buyer.locator(".star-input label").filter({ hasText: "4" }).click();
    await buyer.getByLabel("Comment (optional)").fill("Automated review check");
    await buyer.getByRole("button", { name: "Submit review" }).click();
    await expect(buyer.getByText("Thanks for your review.")).toBeVisible();
    await expect(buyer.getByRole("button", { name: "Submit review" })).toHaveCount(0);
    expect((await db.query("SELECT rating FROM reviews WHERE order_id=$1", [orderId])).rows[0].rating).toBe(4);
  } finally {
    if (orderId) await db.query("DELETE FROM orders WHERE id=$1", [orderId]);
    await db.end();
    await buyer.context().close();
  }
});

test("the admin console, seller centre and customer site are separate", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCount(0);
  // A customer account can't open the console.
  await page.getByLabel("Email address").fill("buyer@example.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".notice.error")).toHaveText("Check your email and password.");
  await page.getByLabel("Email address").fill("admin@example.test");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation", { name: "Admin console" }).getByRole("link", { name: /Orders/ })).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCount(0);
  for (const [link, heading] of [["Orders", "Orders"], ["Listing review", "Listing review"], ["Events", "Events"], ["Users & sellers", "Users & sellers"], ["Settings", "Settings"]]) {
    await page.getByRole("navigation", { name: "Admin console" }).getByRole("link", { name: new RegExp(`^${link}`) }).click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Launch checklist" })).toBeVisible();
  expect((await page.request.get("/setup?token=anything-anything-anything")).status()).toBe(404);
  await context.close();

  const seller = await signedIn(browser, baseURL, "seller@example.test");
  await seller.goto("/sell");
  await expect(seller.getByRole("heading", { name: "Hi, Stage Door Tickets" })).toBeVisible();
  const nav = seller.getByRole("navigation", { name: "Seller dashboard" });
  for (const [link, heading] of [["List tickets", "List tickets"], ["Your listings", "Your listings"], ["Sales", "Sales"], ["Payouts", "Payouts"]]) {
    await nav.getByRole("link", { name: new RegExp(`^${link}`) }).click();
    await expect(seller.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
  await seller.goto("/sell/new");
  await seller.locator(".list-form").getByLabel("Price per ticket (RM)").fill("100");
  await expect(seller.locator(".price-preview .fee-note")).toHaveText("Platform service fee (3%) of RM3 already deducted");
  await expect(seller.locator(".price-preview")).not.toContainText("Buyer pays");
  await expect(seller.locator(".price-preview")).toContainText("You receive RM97");
  await expect(seller.locator(".topbar")).toHaveCount(1);
  await seller.context().close();

  const buyer = await signedIn(browser, baseURL, "buyer@example.test");
  await buyer.goto("/sell/new");
  await expect(buyer).toHaveURL(/\/sell$/);
  await expect(buyer.getByRole("heading", { name: "Sell tickets on Crazy Monkey" })).toBeVisible();
  await buyer.context().close();
});

test("company details stay hidden until the admin fills them in", async ({ browser, baseURL }) => {
  const admin = await signedIn(browser, baseURL, "admin@example.test");
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  const save = async (name: string, regNo: string, address: string) => {
    await admin.goto("/admin/settings");
    await admin.getByLabel("Company name").fill(name);
    await admin.getByLabel("SSM registration no.").fill(regNo);
    await admin.getByLabel("Registered address").fill(address);
    await admin.getByRole("button", { name: "Save company details" }).click();
  };
  try {
    await db.query("UPDATE company_settings SET name=NULL,reg_no=NULL,address=NULL");
    await admin.goto("/legal/terms");
    await expect(admin.getByText('Crazy Monkey Ticketing (the "Platform", "we", "us", "our") is available at')).toBeVisible();
    await expect(admin.getByText("Company No.")).toHaveCount(0);
    await admin.goto("/about");
    await expect(admin.getByRole("heading", { name: "Company information" })).toHaveCount(0);

    await save("QA Holdings Sdn. Bhd.", "", "");
    await expect(admin.locator(".notice.error")).toHaveText("Fill in the company name, registration number and address together, or leave all three empty.");

    await save("QA Holdings Sdn. Bhd.", "202601999999", "1 Jalan QA, Kuala Lumpur");
    await expect(admin.getByText("Company details saved.")).toBeVisible();
    await admin.goto("/legal/terms");
    await expect(admin.getByText("is operated by QA Holdings Sdn. Bhd. (Company No. 202601999999), 1 Jalan QA, Kuala Lumpur")).toBeVisible();
    await expect(admin.locator(".copyright")).toContainText("QA Holdings Sdn. Bhd. (202601999999)");

    await save("", "", "");
    await expect(admin.getByText("Company details saved.")).toBeVisible();
    await admin.goto("/legal/privacy");
    await expect(admin.getByText("Crazy Monkey Ticketing is the data user responsible for your personal data.")).toBeVisible();
    await expect(admin.locator(".copyright")).not.toContainText("QA Holdings");
  } finally {
    await db.query("UPDATE company_settings SET name=NULL,reg_no=NULL,address=NULL");
    await db.end();
    await admin.context().close();
  }
});

test("event links are optional: empty, 无, or a bare domain", async ({ browser, baseURL }) => {
  const admin = await signedIn(browser, baseURL, "admin@example.test");
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  const titles = [`Optional Links A ${Date.now()}`, `Optional Links B ${Date.now()}`];
  const create = async (title: string, policy: string, site: string) => {
    await admin.goto("/admin/events/new");
    await admin.getByLabel("Event name").fill(title);
    await admin.getByLabel("Venue", { exact: true }).fill("Test Hall");
    await admin.getByLabel("City").fill("Kuala Lumpur");
    await admin.getByLabel("Start (Malaysia time)").fill(new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 16));
    await admin.getByLabel("Description").fill("Optional links fixture.");
    await admin.getByLabel("Official resale policy URL").fill(policy);
    await admin.getByLabel("Official transfer site").fill(site);
    await admin.getByRole("button", { name: "Publish event" }).click();
    await expect(admin.getByText("Event published.")).toBeVisible();
  };
  try {
    await create(titles[0], "无", "");
    await create(titles[1], "www.example.com/resale", "tickets.example.com");
    const rows = (await db.query("SELECT title,transfer_policy_url,transfer_host FROM events WHERE title=ANY($1) ORDER BY title", [titles])).rows;
    expect(rows).toEqual([
      { title: titles[0], transfer_policy_url: null, transfer_host: null },
      { title: titles[1], transfer_policy_url: "https://www.example.com/resale", transfer_host: "tickets.example.com" },
    ]);
  } finally {
    await db.query("DELETE FROM events WHERE title=ANY($1)", [titles]);
    await db.end();
    await admin.context().close();
  }
});
