import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;

function normalizeInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run database migrations.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: normalizeInt(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
  connectionTimeoutMillis: normalizeInt(process.env.DB_CONNECT_TIMEOUT_MS, 5_000),
  ssl:
    process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

try {
  const db = drizzle(pool);
  const migrationsFolder = fileURLToPath(
    new URL("../src/migrations", import.meta.url),
  );

  console.log("[db:migrate] Applying migrations...");
  await migrate(db, { migrationsFolder });
  console.log("[db:migrate] Migrations applied.");
} finally {
  await pool.end();
}
