import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { normalizeInt } from "@vibeguard/shared";
import { schema } from "./schema";

// NOTE(I03): Singleton pattern — getPool()/getDb() lazily create one Pool/Drizzle
// instance per process. Not thread-safe (not a concern in Node.js single-threaded
// event loop). However, closeDb() resets the singletons to undefined, allowing
// re-creation on the next call — callers must ensure no concurrent operations
// are in-flight when calling closeDb().
//
// NOTE(I17): Module-level mutable globals (pool, database) make this module hard
// to test in isolation — tests share state across runs within the same process.
// To test properly, use dependency injection at the call site rather than
// importing getDb/getPool directly in the code under test.
let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize the database client.");
  }

  return databaseUrl;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: normalizeInt(process.env.DB_POOL_MAX, 10),
      idleTimeoutMillis: normalizeInt(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
      connectionTimeoutMillis: normalizeInt(process.env.DB_CONNECT_TIMEOUT_MS, 5_000),
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
  }

  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!database) {
    database = drizzle(getPool(), { schema });
  }

  return database;
}

export async function closeDb(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
  database = undefined;
}
