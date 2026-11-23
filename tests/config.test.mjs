import test from "node:test";
import assert from "node:assert/strict";
import { databaseUrl } from "../lib/config.ts";

function withEnv(env, run) {
  const saved = { DATABASE_URL: process.env.DATABASE_URL, DATABASE_PASSWORD: process.env.DATABASE_PASSWORD };
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  try { return run(); } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

const pooler = "postgresql://postgres.abc:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres";

test("database URL rejects missing, partial and placeholder values", () => {
  withEnv({ DATABASE_URL: undefined, DATABASE_PASSWORD: undefined }, () => assert.equal(databaseUrl(), null));
  withEnv({ DATABASE_URL: "postgres.abc", DATABASE_PASSWORD: undefined }, () => assert.equal(databaseUrl(), null));
  withEnv({ DATABASE_URL: "https://example.com", DATABASE_PASSWORD: undefined }, () => assert.equal(databaseUrl(), null));
  withEnv({ DATABASE_URL: pooler, DATABASE_PASSWORD: undefined }, () => assert.equal(databaseUrl(), null));
});

test("DATABASE_PASSWORD fills in the password, special characters included", () => {
  withEnv({ DATABASE_URL: pooler, DATABASE_PASSWORD: "p@ss#w%rd/[x]" }, () => {
    const url = new URL(databaseUrl());
    assert.equal(decodeURIComponent(url.password), "p@ss#w%rd/[x]");
    assert.equal(url.username, "postgres.abc");
    assert.equal(url.hostname, "aws-1-ap-southeast-1.pooler.supabase.com");
    assert.equal(url.port, "6543");
  });
  withEnv({ DATABASE_URL: "postgresql://ticketing:ticketing@127.0.0.1:5432/ticketing", DATABASE_PASSWORD: undefined },
    () => assert.equal(databaseUrl(), "postgresql://ticketing:ticketing@127.0.0.1:5432/ticketing"));
});
