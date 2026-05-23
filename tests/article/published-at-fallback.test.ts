import { describe, expect, it } from "vitest";

import { resolvePublishedAt } from "../../packages/content/src/feed/normalize";

describe("resolvePublishedAt", () => {
  it("should fall back to fetchedAt when publishedAt is missing", () => {
    const fetchedAt = new Date("2026-05-19T10:00:00.000Z");
    const result = resolvePublishedAt(undefined, fetchedAt);

    expect(result.publishedAt.toISOString()).toBe("2026-05-19T10:00:00.000Z");
    expect(result.isFallback).toBe(true);
  });

  it("should fall back to fetchedAt when publishedAt is invalid", () => {
    const fetchedAt = new Date("2026-05-19T10:00:00.000Z");
    const result = resolvePublishedAt("not-a-date", fetchedAt);

    expect(result.publishedAt.toISOString()).toBe("2026-05-19T10:00:00.000Z");
    expect(result.isFallback).toBe(true);
  });

  it("should fall back to fetchedAt when publishedAt is null", () => {
    const fetchedAt = new Date("2026-05-19T10:00:00.000Z");
    const result = resolvePublishedAt(null, fetchedAt);

    expect(result.publishedAt.toISOString()).toBe("2026-05-19T10:00:00.000Z");
    expect(result.isFallback).toBe(true);
  });
});
