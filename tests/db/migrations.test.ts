import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "packages/db/src/migrations");

describe("database migrations", () => {
  it("keeps reset migration history as a single initializer", () => {
    const sqlFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const journal = JSON.parse(
      readFileSync(join(migrationsDir, "meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ tag: string }> };

    expect(sqlFiles).toEqual([
      "0000_vibeguard_init.sql",
      "0001_lazy_kitty_pryde.sql",
    ]);
    expect(journal.entries).toEqual([
      expect.objectContaining({ tag: "0000_vibeguard_init" }),
      expect.objectContaining({ tag: "0001_lazy_kitty_pryde" }),
    ]);
  });

  it("keeps operational indexes and updated_at triggers in the initializer", () => {
    const sql = readFileSync(
      join(migrationsDir, "0000_vibeguard_init.sql"),
      "utf8",
    );

    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    expect(sql).toContain('CREATE INDEX "feeds_enabled_poll_idx"');
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "idx_articles_title_en_trgm"',
    );
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "idx_security_advisories_details_trgm"',
    );
    expect(sql).toContain('CREATE TRIGGER "security_advisories_set_updated_at"');
    expect(sql).toContain(
      'CREATE TRIGGER "security_affected_packages_set_updated_at"',
    );
    expect(sql).not.toContain('CREATE INDEX "feeds_enabled_idx"');
  });
});
