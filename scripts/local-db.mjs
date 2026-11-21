import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const databaseDir = resolve(".data/postgres");
mkdirSync(resolve(".data"), { recursive: true });
const postgres = new EmbeddedPostgres({
  databaseDir, port: 5442, user: "ticketing", password: "ticketing",
  persistent: true, autoRehydrateSymlinks: true,
});
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname='ticketing'");
await client.end();
if (!result.rowCount) await postgres.createDatabase("ticketing");
console.log("Local PostgreSQL is ready on port 5442.");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await postgres.stop();
    process.exit(0);
  });
}
