import { readFile, readdir } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const operation = process.argv[2];
// Migrations take an advisory lock, so on Supabase point DATABASE_MIGRATION_URL at the session pooler (port 5432).
const databaseUrl = (operation === "migrate" && process.env.DATABASE_MIGRATION_URL) || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

async function clientConfig(url) {
  const raw = process.env.DATABASE_SSL_CA?.trim();
  const supabase = /(^|\.)supabase\.(com|co)$/.test(new URL(url).hostname);
  if (!raw && !supabase) return { connectionString: url };
  const ca = !raw ? await readFile(new URL("../db/supabase-root-2021.crt", import.meta.url), "utf8")
    : raw.includes("BEGIN CERTIFICATE") ? raw.replace(/\\n/g, "\n") : Buffer.from(raw, "base64").toString("utf8");
  const parsed = new URL(url);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) parsed.searchParams.delete(key);
  return { connectionString: parsed.toString(), ssl: { ca, rejectUnauthorized: true } };
}

const client = new pg.Client(await clientConfig(databaseUrl));
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
  await client.query(await readFile(new URL("../db/post-migrate.sql", import.meta.url), "utf8"));
}

async function seed() {
  const database = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(database.hostname) || process.env.PAYMENT_MODE !== "demo" ||
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(process.env.APP_URL ?? "")) {
    throw new Error("Seeding is only allowed on a local demo database.");
  }
  const password = "CrazyMonkey2027!";
  await createUser("buyer@example.test", "Jamie Tan", password, "buyer");
  await createUser("seller@example.test", "Stage Door Tickets", password, "seller");
  await createUser("admin@example.test", "Crazy Monkey Admin", password, "admin");
  await client.query("UPDATE users SET email_verified=true WHERE email=ANY($1)", [["buyer@example.test","seller@example.test","admin@example.test"]]);
  await client.query(`UPDATE users SET phone='60123456789',payout_bank='Maybank',payout_name='Stage Door Tickets',
    payout_account='5123 4567 8901' WHERE email='seller@example.test'`);
  await client.query(`UPDATE payment_settings SET bank_name='Maybank',account_name='Crazy Monkey Ticketing',
    account_number='5140 1234 5678',duitnow_id='CRAZYMONKEY' WHERE bank_name IS NULL`);
  const { rows: [seller] } = await client.query("SELECT id FROM users WHERE email='seller@example.test'");
  const fixtures = [
    ["neon-nights", "Neon Nights KL", "Concerts", "Axiata Arena", "Kuala Lumpur", "2027-01-23T20:00:00+08:00",
      "An after-dark mix of live electronic sets, big bass and immersive lights in Bukit Jalil.", "hero", true, 18900, "Standing", 16800],
    ["after-hours", "After Hours Live", "Concerts", "Zepp Kuala Lumpur", "Kuala Lumpur", "2027-02-06T20:30:00+08:00",
      "A night of live indie sets and late-night favourites at Zepp Kuala Lumpur.", "concert", false, 12900, "General admission", 12900],
    ["good-vibes-weekender", "Good Vibes Weekender", "Festivals", "Surf Beach, Sunway Lagoon", "Subang Jaya", "2027-02-13T15:00:00+08:00",
      "Two stages, open-air sets and a full afternoon into evening of live music in Sunway.", "festival", false, 21500, "Day pass", 19900],
    ["kl-basketball-finals", "KL Basketball Finals", "Sports", "MABA Stadium", "Kuala Lumpur", "2027-02-20T19:00:00+08:00",
      "Watch the league finalists face off under the lights at MABA Stadium.", "sports", false, 7900, "Upper bowl", 8800],
    ["an-evening-on-stage", "An Evening on Stage", "Arts & Theatre", "KLPAC", "Kuala Lumpur", "2027-03-06T19:30:00+08:00",
      "An intimate evening of contemporary theatre and live performance.", "theatre", false, 13800, "Stalls", 12800],
  ];
  const firstDate = new Date(fixtures[0][5]).getTime();
  const week = 7 * 86400000;
  const offset = Math.max(0, Math.ceil((Date.now() + week - firstDate) / week)) * week;
  for (const [slug,title,category,venue,city,starts,description,image,featured,price,section,face] of fixtures) {
    const { rows: [event] } = await client.query(`
      INSERT INTO events (slug,title,category,venue,city,starts_at,description,image,featured,transfer_host)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'example.com') ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [slug,title,category,venue,city,new Date(new Date(starts).getTime() + offset),description,image,featured]);
    if (event) await client.query(`
      INSERT INTO listings (event_id,seller_id,section,price,face_value,quantity,available,status,proof)
      VALUES ($1,$2,$3,$4,$5,12,12,'active','Local demo fixture')`, [event.id,seller.id,section,price,face]);
  }
  await seedCatalogue(password, seller.id, offset);
}

/** A fuller local catalogue: more cities, a second seller, generated posters, reviews and saved events. */
async function seedCatalogue(password, sellerId, offset) {
  const { default: sharp } = await import("sharp");
  await createUser("seller2@example.test", "Ah Meng Tickets", password, "seller");
  await client.query(`UPDATE users SET email_verified=true,phone='60198765432',payout_bank='Public Bank',payout_name='Lim Ah Meng',
    payout_account='4123 9876 5432' WHERE email='seller2@example.test'`);
  const { rows: [{ id: otherId }] } = await client.query("SELECT id FROM users WHERE email='seller2@example.test'");
  const { rows: [{ id: buyerId }] } = await client.query("SELECT id FROM users WHERE email='buyer@example.test'");
  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const poster = async (title, kicker, [from, to]) => {
    const words = title.split(" ");
    const lines = [];
    for (const word of words) {
      const last = lines.at(-1);
      if (last && (last + " " + word).length <= 12) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    const text = lines.map((line, i) => `<text x="64" y="${760 + i * 104 - (lines.length - 1) * 52}" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="800" font-size="96" fill="#fff">${escape(line.toUpperCase())}</text>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="#0b0906"/></linearGradient>
      <radialGradient id="r" cx=".72" cy=".28" r=".55"><stop offset="0" stop-color="${to}" stop-opacity=".85"/><stop offset="1" stop-color="${to}" stop-opacity="0"/></radialGradient></defs>
      <rect width="900" height="1200" fill="url(#g)"/><circle cx="650" cy="330" r="360" fill="url(#r)"/>
      <circle cx="650" cy="330" r="190" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/>
      <circle cx="650" cy="330" r="260" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>
      <rect x="64" y="96" width="120" height="8" fill="${to}"/>
      <text x="64" y="160" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="700" font-size="32" letter-spacing="8" fill="#fff" fill-opacity=".85">${escape(kicker.toUpperCase())}</text>
      ${text}
      <text x="64" y="1110" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="600" font-size="30" letter-spacing="6" fill="${to}">LIVE IN MALAYSIA</text></svg>`;
    const data = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
    const { rows: [row] } = await client.query("INSERT INTO media (data,mime) VALUES ($1,'image/webp') RETURNING id", [data]);
    return row.id;
  };
  const catalogue = [
    ["midnight-echoes", "Midnight Echoes Asia Tour", "Concerts", "Axiata Arena", "Kuala Lumpur", "Bukit Jalil, 57000 Kuala Lumpur", "2027-01-30T20:00:00+08:00",
      "The arena tour of the year arrives in Bukit Jalil with a full band, a new stage design and two hours of fan favourites.", true, ["#3b0f6b", "#e2bf55"],
      [["Rock Zone A", 45800, 39800, otherId, 6], ["Level 1 Seated", 32800, 32800, sellerId, 4], ["Level 3 Seated", 16800, 18800, otherId, 8]]],
    ["kl-city-derby", "KL City Derby", "Sports", "Bukit Jalil National Stadium", "Kuala Lumpur", "Jalan Barat, Bukit Jalil, 57000 Kuala Lumpur", "2027-02-14T20:45:00+08:00",
      "The capital's biggest football rivalry under the lights. Arrive early for the pre-match atmosphere.", false, ["#7a0b0b", "#f0cf65"],
      [["Category 1", 9000, 8000, otherId, 10], ["Category 2", 5500, 5000, sellerId, 6]]],
    ["comedy-night-live", "Comedy Night Live", "Arts & Theatre", "The Bee, Publika", "Kuala Lumpur", "Solaris Dutamas, 50480 Kuala Lumpur", "2027-02-19T21:00:00+08:00",
      "Stand-up from Malaysia's sharpest comics in an intimate room. Ages 18 and above.", false, ["#1e1b4b", "#f0cf65"],
      [["Free seating", 8800, 8800, sellerId, 4]]],
    ["penang-jazz-weekend", "Penang Jazz Weekend", "Festivals", "Esplanade", "George Town", "Jalan Tun Syed Sheh Barakbah, 10200 George Town", "2027-02-27T17:00:00+08:00",
      "Seaside sets, food trucks and sunset jam sessions across two evenings in George Town.", false, ["#0f4c5c", "#e8c468"],
      [["2-day pass", 28000, 26000, sellerId, 5]]],
    ["starlight-fan-concert", "Starlight Fan Concert", "Concerts", "Persada Johor", "Johor Bahru", "Jalan Abdullah Ibrahim, 80000 Johor Bahru", "2027-03-13T19:00:00+08:00",
      "An evening of songs, games and fan moments. Includes a group photo session for VIP standing.", false, ["#b0245c", "#ffd36e"],
      [["VIP Standing", 69800, 59800, otherId, 2]]],
    ["silk-road-musical", "Silk Road: A New Musical", "Arts & Theatre", "Istana Budaya", "Kuala Lumpur", "Jalan Tun Razak, 50400 Kuala Lumpur", "2027-03-20T20:00:00+08:00",
      "An original musical following traders across Asia, with a live orchestra and 40-strong cast.", false, ["#4a3112", "#e2bf55"],
      [["Grand Circle", 23800, 23800, sellerId, 4]]],
    ["borneo-sound-festival", "Borneo Sound Festival", "Festivals", "Sarawak Cultural Village", "Kuching", "Pantai Damai, 93756 Kuching", "2027-04-10T14:00:00+08:00",
      "Three days of world music, workshops and rainforest stages on the Damai coast.", false, ["#14532d", "#facc15"],
      [["3-day pass", 35000, 33000, otherId, 6]]],
  ];
  for (const [slug, title, category, venue, city, address, starts, description, featured, colors, listings] of catalogue) {
    const exists = await client.query("SELECT 1 FROM events WHERE slug=$1", [slug]);
    if (exists.rowCount) continue;
    const posterId = await poster(title, category, colors);
    const image = { Concerts: "concert", Festivals: "festival", Sports: "sports", "Arts & Theatre": "theatre" }[category];
    const { rows: [event] } = await client.query(`INSERT INTO events (slug,title,category,venue,city,venue_address,starts_at,description,image,featured,transfer_host,poster_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'example.com',$11) RETURNING id`,
    [slug, title, category, venue, city, address, new Date(new Date(starts).getTime() + offset), description, image, featured, posterId]);
    for (const [section, price, face, owner, quantity] of listings) {
      await client.query(`INSERT INTO listings (event_id,seller_id,section,price,face_value,quantity,available,status,proof)
        VALUES ($1,$2,$3,$4,$5,$6,$6,'active','Local demo fixture')`, [event.id, owner, section, price, face, quantity]);
    }
  }
  // Completed sales with reviews, so seller ratings show up.
  const { rows: [reviewed] } = await client.query("SELECT count(*)::int AS count FROM reviews");
  if (!reviewed.count) {
    const sales = [[otherId, 5, "Transferred within an hour. Tickets exactly as described!"], [otherId, 5, "转票很快，很靠谱的卖家。"],
      [otherId, 4, "Smooth, would buy again."], [sellerId, 5, "Very responsive on WhatsApp, thank you."]];
    for (const [owner, rating, comment] of sales) {
      const { rows: [listing] } = await client.query("SELECT id,price FROM listings WHERE seller_id=$1 AND proof='Local demo fixture' ORDER BY price DESC LIMIT 1", [owner]);
      const { rows: [order] } = await client.query(`INSERT INTO orders (listing_id,buyer_id,quantity,subtotal,buyer_bps,seller_bps,buyer_fee,seller_fee,payment_mode,status,expires_at,paid_at,delivered_at,transfer_ref,created_at)
        VALUES ($1,$2,1,$3,300,300,$4,$4,'demo','confirmed',now()-interval '20 days',now()-interval '20 days',now()-interval '19 days','DEMO-REF',now()-interval '20 days') RETURNING id`,
      [listing.id, buyerId, listing.price, Math.floor((listing.price * 300 + 5000) / 10000)]);
      await client.query("INSERT INTO reviews (order_id,seller_id,buyer_id,rating,comment) VALUES ($1,$2,$3,$4,$5)", [order.id, owner, buyerId, rating, comment]);
    }
    await client.query(`INSERT INTO favorites (user_id,event_id) SELECT $1,id FROM events WHERE slug IN ('midnight-echoes','penang-jazz-weekend') ON CONFLICT DO NOTHING`, [buyerId]);
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
    const id = await createUser(email, "Crazy Monkey Admin", password, "admin");
    if (!id) throw new Error("An account with this email already exists.");
    console.log("Admin created.");
  } else throw new Error("Use migrate, seed, or admin.");
} finally {
  await client.end();
}
