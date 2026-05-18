import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to load Code/drizzle.config.ts.");
}

export default defineConfig({
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
