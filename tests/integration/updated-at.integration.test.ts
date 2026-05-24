import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getPool } from "@vibeguard/db";

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase("updated_at integration", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("should change updated_at after a row update in Postgres", async () => {
    const pool = getPool();
    const feedUrl = `https://example.com/feed-${Date.now()}.xml`;

    try {
      const insertResult = await pool.query<{
        id: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `
          insert into feeds (name, site_url, feed_url, feed_type)
          values ($1, $2, $3, $4)
          returning id, created_at, updated_at
        `,
        ["Integration Test Feed", "https://example.com", feedUrl, "rss"],
      );

      expect(insertResult.rows).toHaveLength(1);
      const inserted = insertResult.rows[0]!;

      await pool.query("select pg_sleep(1)");

      const updateResult = await pool.query<{
        updated_at: Date;
      }>(
        `
          update feeds
          set name = $1
          where id = $2
          returning updated_at
        `,
        ["Integration Test Feed Updated", inserted.id],
      );

      expect(updateResult.rows).toHaveLength(1);
      const updated = updateResult.rows[0]!;

      expect(updated.updated_at.getTime()).toBeGreaterThan(
        inserted.updated_at.getTime(),
      );
    } finally {
      await pool.query("delete from feeds where feed_url = $1", [feedUrl]);
    }
  });
});
