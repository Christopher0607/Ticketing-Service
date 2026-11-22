import type { Pool } from "pg";
import { migrations, postMigrateSql } from "./migrations.generated";

const globalMigrations = globalThis as typeof globalThis & { schemaReady?: Promise<void> };

/**
 * Applies pending migrations the first time a server instance touches the database, so a fresh
 * Supabase project needs no manual setup. Each migration runs in its own transaction under a
 * transaction-scoped advisory lock (works through Supabase's transaction pooler). Disable with AUTO_MIGRATE=false.
 */
export function ensureMigrated(pool: Pool) {
  if (process.env.AUTO_MIGRATE === "false") return Promise.resolve();
  return globalMigrations.schemaReady ??= apply(pool).catch((error) => {
    globalMigrations.schemaReady = undefined;
    throw error;
  });
}

async function apply(pool: Pool) {
  const client = await pool.connect();
  try {
    try {
      await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    } catch (error) {
      // Another instance created it at the same moment.
      if (!["23505", "42P07"].includes((error as { code?: string }).code ?? "")) throw error;
    }
    const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const done = new Set(rows.map((row) => row.name));
    const pending = migrations.filter((migration) => !done.has(migration.name));
    if (!pending.length) return;
    for (const migration of pending) {
      await client.query("BEGIN");
      try {
        await client.query("SELECT pg_advisory_xact_lock(66547193)");
        const { rowCount } = await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [migration.name]);
        if (!rowCount) {
          await client.query(migration.sql);
          await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration.name]);
          console.log("Applied migration", migration.name);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    await client.query(postMigrateSql);
  } finally {
    client.release();
  }
}
