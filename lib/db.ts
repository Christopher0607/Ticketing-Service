import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";
import { ensureMigrated } from "./migrate";
import { supabaseRootCa } from "./migrations.generated";
import { databaseUrl } from "./config";

const globalDatabase = globalThis as typeof globalThis & { ticketPool?: Pool };

/**
 * CA certificate for verified TLS: DATABASE_SSL_CA (PEM text or base64 of the PEM), or Supabase's
 * public root CA for Supabase hosts.
 */
function certificate(url: string) {
  const value = process.env.DATABASE_SSL_CA?.trim();
  if (value) return value.includes("BEGIN CERTIFICATE") ? value.replace(/\\n/g, "\n") : Buffer.from(value, "base64").toString("utf8");
  try {
    if (/(^|\.)supabase\.(com|co)$/.test(new URL(url).hostname)) return supabaseRootCa;
  } catch { /* invalid URL is reported by pg */ }
  return null;
}

/**
 * Connection settings for a local PostgreSQL, a VPS, or Supabase's pooler.
 * Supabase transaction pooling (port 6543) suits serverless hosts such as Netlify:
 * keep the pool tiny and avoid session-level startup parameters.
 */
export function databaseConfig(url = databaseUrl()): PoolConfig {
  if (!url) throw new Error("DATABASE_URL is missing or is not a postgresql:// connection string");
  const pooled = /pooler\.supabase\.com/.test(url) || process.env.DATABASE_POOLED === "true";
  const ca = certificate(url);
  // Escape hatch if a provider's certificate chain can't be verified: encrypted, but unverified.
  const verify = process.env.DATABASE_SSL_VERIFY !== "false";
  let connectionString = url;
  if (ca || !verify) {
    // Explicit TLS settings win only if the URL carries no ssl parameters of its own.
    const parsed = new URL(url);
    for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) parsed.searchParams.delete(key);
    connectionString = parsed.toString();
  }
  return {
    connectionString,
    ...(!verify ? { ssl: { rejectUnauthorized: false } } : ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
    max: Number(process.env.DATABASE_POOL_MAX) || (pooled ? 3 : 10),
    idleTimeoutMillis: pooled ? 10000 : 30000,
    connectionTimeoutMillis: 8000,
    ...(pooled ? {} : { statement_timeout: 15000 }),
  };
}

function pool() {
  return globalDatabase.ticketPool ??= new Pool(databaseConfig());
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  await ensureMigrated(pool());
  return (await pool().query<T>(sql, values)).rows;
}

export async function tx<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureMigrated(pool());
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
