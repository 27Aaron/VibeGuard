import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { normalizeInt } from "@vibeguard/shared";
import { schema } from "./schema";

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
