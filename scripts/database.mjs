import { readFile, readdir } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const operation = process.argv[2];
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

function hash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function createUser(email, name, password, role) {
  const { rows: [row] } = await client.query(`
    INSERT INTO users (email,name,password_hash,role,email_verified) VALUES ($1,$2,$3,$4,true)
    ON CONFLICT (email) DO NOTHING RETURNING id`, [email, name, hash(password), role]);
  return row?.id;
}

async function migrate() {
  await client.query("SELECT pg_advisory_lock(66547193)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of (await readdir(new URL("../db/", import.meta.url))).filter((file) => /^\d+_.+\.sql$/.test(file)).sort()) {
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name])).rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(new URL(`../db/${name}`, import.meta.url), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log("Applied", name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

async function seed() {
  const database = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(database.hostname) || process.env.PAYMENT_MODE !== "demo" ||
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(process.env.APP_URL ?? "")) {
    throw new Error("Seeding is only allowed on a local demo database.");
  }
  const password = "SetlistDemo2027!";
  await createUser("buyer@example.test", "Jamie Tan", password, "buyer");
  await createUser("seller@example.test", "Stage Door Tickets", password, "seller");
  await createUser("admin@example.test", "Setlist Admin", password, "admin");
  await client.query("UPDATE users SET email_verified=true WHERE email=ANY($1)", [["buyer@example.test","seller@example.test","admin@example.test"]]);
  const { rows: [seller] } = await client.query("SELECT id FROM users WHERE email='seller@example.test'");
  const fixtures = [
    ["neon-nights", "Neon Nights KL", "Concerts", "Axiata Arena", "Kuala Lumpur", "2027-01-23T20:00:00+08:00",
      "An after-dark mix of live electronic sets, big bass and immersive lights in Bukit Jalil.", "hero", true, 18900, "Standing"],
    ["after-hours", "After Hours Live", "Concerts", "Zepp Kuala Lumpur", "Kuala Lumpur", "2027-02-06T20:30:00+08:00",
      "A night of live indie sets and late-night favourites at Zepp Kuala Lumpur.", "concert", false, 12900, "General admission"],
    ["good-vibes-weekender", "Good Vibes Weekender", "Festivals", "Surf Beach, Sunway Lagoon", "Subang Jaya", "2027-02-13T15:00:00+08:00",
      "Two stages, open-air sets and a full afternoon into evening of live music in Sunway.", "festival", false, 21500, "Day pass"],
    ["kl-basketball-finals", "KL Basketball Finals", "Sports", "MABA Stadium", "Kuala Lumpur", "2027-02-20T19:00:00+08:00",
      "Watch the league finalists face off under the lights at MABA Stadium.", "sports", false, 7900, "Upper bowl"],
    ["an-evening-on-stage", "An Evening on Stage", "Arts & Theatre", "KLPAC", "Kuala Lumpur", "2027-03-06T19:30:00+08:00",
      "An intimate evening of contemporary theatre and live performance.", "theatre", false, 13800, "Stalls"],
  ];
  const firstDate = new Date(fixtures[0][5]).getTime();
  const week = 7 * 86400000;
  const offset = Math.max(0, Math.ceil((Date.now() + week - firstDate) / week)) * week;
  for (const [slug,title,category,venue,city,starts,description,image,featured,price,section] of fixtures) {
    const { rows: [event] } = await client.query(`
      INSERT INTO events (slug,title,category,venue,city,starts_at,description,image,featured,transfer_host)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'example.com') ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [slug,title,category,venue,city,new Date(new Date(starts).getTime() + offset),description,image,featured]);
    if (event) await client.query(`
      INSERT INTO listings (event_id,seller_id,section,price,quantity,available,status,proof)
      VALUES ($1,$2,$3,$4,12,12,'active','Local demo fixture')`, [event.id,seller.id,section,price]);
  }
}

try {
  if (operation === "migrate") await migrate();
  else if (operation === "seed") await seed();
  else if (operation === "admin") {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password || password.length < 14 || password.length > 128) {
      throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (14–128 characters) before provisioning.");
    }
    const id = await createUser(email, "Setlist Admin", password, "admin");
    if (!id) throw new Error("An account with this email already exists.");
    console.log("Admin created.");
  } else throw new Error("Use migrate, seed, or admin.");
} finally {
  await client.end();
}
