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
    // Enough connections for a page's parallel queries; kept open between visits because opening one
    // (TLS + authentication) costs several network round trips.
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: pooled ? 300000 : 30000,
    connectionTimeoutMillis: 8000,
    ...(pooled ? {} : { statement_timeout: 15000 }),
  };
}

function pool() {
  if (!globalDatabase.ticketPool) {
    globalDatabase.ticketPool = new Pool(databaseConfig());
    // An idle connection closed by the server must not crash the process; the pool replaces it.
    globalDatabase.ticketPool.on("error", (error) => console.error("Idle database connection closed", error.message));
  }
  return globalDatabase.ticketPool;
}

/** A connection that died while the server instance was idle fails without a PostgreSQL error code. */
const droppedConnection = (error: unknown) => !(error as { code?: string }).code ||
  ["ECONNRESET", "EPIPE", "57P01", "57P05"].includes((error as { code?: string }).code ?? "");

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  await ensureMigrated(pool());
  try {
    return (await pool().query<T>(sql, values)).rows;
  } catch (error) {
    // Reads are retried once on a fresh connection; writes are not, so nothing is applied twice.
    if (!/^\s*SELECT\b/i.test(sql) || !droppedConnection(error)) throw error;
    return (await pool().query<T>(sql, values)).rows;
  }
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
