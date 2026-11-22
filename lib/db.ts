import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

const globalDatabase = globalThis as typeof globalThis & { ticketPool?: Pool };

/** CA certificate for verified TLS (e.g. Supabase's), given as PEM text or base64 of the PEM. */
function certificate() {
  const value = process.env.DATABASE_SSL_CA?.trim();
  if (!value) return null;
  return value.includes("BEGIN CERTIFICATE") ? value.replace(/\\n/g, "\n") : Buffer.from(value, "base64").toString("utf8");
}

/**
 * Connection settings for a local PostgreSQL, a VPS, or Supabase's pooler.
 * Supabase transaction pooling (port 6543) suits serverless hosts such as Netlify:
 * keep the pool tiny and avoid session-level startup parameters.
 */
export function databaseConfig(url = process.env.DATABASE_URL): PoolConfig {
  if (!url) throw new Error("DATABASE_URL is required");
  const pooled = /pooler\.supabase\.com/.test(url) || process.env.DATABASE_POOLED === "true";
  const ca = certificate();
  let connectionString = url;
  if (ca) {
    // Explicit TLS settings win only if the URL carries no ssl parameters of its own.
    const parsed = new URL(url);
    for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) parsed.searchParams.delete(key);
    connectionString = parsed.toString();
  }
  return {
    connectionString,
    ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
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
  return (await pool().query<T>(sql, values)).rows;
}

export async function tx<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
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
