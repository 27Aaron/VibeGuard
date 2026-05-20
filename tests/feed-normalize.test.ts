import { describe, expect, it } from "vitest";

import {
  normalizeFeedItem,
} from "../packages/content/src/feed/normalize";
import {
  buildArticleInsert,
  insertFeedItem,
} from "../packages/content/src/feed/store";

describe("normalizeFeedItem", () => {
  it("should normalize rss item into a stable record", () => {
    const fetchedAt = new Date("2026-05-19T12:00:00.000Z");

    const result = normalizeFeedItem(
      {
        title: " Example title ",
        link: " https://example.com/post ",
        isoDate: "2026-05-19T10:00:00.000Z",
      },
      fetchedAt,
    );

    expect(result.titleEn).toBe("Example title");
    expect(result.url).toBe("https://example.com/post");
    expect(result.publishedAt.toISOString()).toBe("2026-05-19T10:00:00.000Z");
    expect(result.publishedAtIsFallback).toBe(false);
    expect(result.fetchedAt).toBe(fetchedAt);
  });

  it("should prefer isoDate over pubDate when both exist", () => {
    const fetchedAt = new Date("2026-05-19T12:00:00.000Z");

    const result = normalizeFeedItem(
      {
        title: "Example title",
        link: "https://example.com/post",
        isoDate: "2026-05-19T11:00:00.000Z",
        pubDate: "2026-05-19T10:00:00.000Z",
      },
      fetchedAt,
    );

    expect(result.publishedAt.toISOString()).toBe("2026-05-19T11:00:00.000Z");
    expect(result.publishedAtIsFallback).toBe(false);
  });

  it("should fall back to pubDate when isoDate is invalid", () => {
    const fetchedAt = new Date("2026-05-19T12:00:00.000Z");

    const result = normalizeFeedItem(
      {
        title: "Example title",
        link: "https://example.com/post",
        isoDate: "not-a-date",
        pubDate: "2026-05-19T10:00:00.000Z",
      },
      fetchedAt,
    );

    expect(result.publishedAt.toISOString()).toBe("2026-05-19T10:00:00.000Z");
    expect(result.publishedAtIsFallback).toBe(false);
  });

  it("should reject items without a title", () => {
    expect(() =>
      normalizeFeedItem({
        link: "https://example.com/post",
      }),
    ).toThrow("Feed item must include title and link");
  });

  it("should reject items without a link", () => {
    expect(() =>
      normalizeFeedItem({
        title: "Example title",
      }),
    ).toThrow("Feed item must include title and link");
  });

  it("should reject feed item links that are not complete http URLs", () => {
    expect(() =>
      normalizeFeedItem({
        title: "Example title",
        link: "javascript:alert(1)",
      }),
    ).toThrow("Feed item link must use http or https.");

    expect(() =>
      normalizeFeedItem({
        title: "Example title",
        link: "/relative-post",
      }),
    ).toThrow("Feed item link must be a complete URL.");
  });

  it("should build a minimal article insert payload", () => {
    const fetchedAt = new Date("2026-05-19T12:00:00.000Z");

    const result = buildArticleInsert({
      feedId: "feed-1",
      sourceName: " Example Feed ",
      item: {
        title: "Example title",
        link: "https://example.com/post",
        pubDate: "2026-05-19T10:00:00.000Z",
        creator: "Example Author",
        customField: "kept",
      },
      fetchedAt,
    });

    expect(result).toMatchObject({
      feedId: "feed-1",
      sourceName: "Example Feed",
      titleEn: "Example title",
      url: "https://example.com/post",
      status: "pending",
      publishedAtIsFallback: false,
      fetchedAt,
    });
    expect(result.rawMeta).toMatchObject({
      title: "Example title",
      link: "https://example.com/post",
      pubDate: "2026-05-19T10:00:00.000Z",
      creator: "Example Author",
      customField: "kept",
    });
  });
});

describe("insertFeedItem", () => {
  it("should return the inserted article when insert succeeds", async () => {
    const insertedArticle = {
      id: "article-1",
      url: "https://example.com/post",
    };
    const returning = async () => [insertedArticle];
    const onConflictDoNothing = () => ({ returning });
    const values = () => ({ onConflictDoNothing });
    const insert = () => ({ values });
    const findFirst = async () => undefined;
    const db = {
      insert,
      query: { articles: { findFirst } },
    } as never;

    const result = await insertFeedItem(db, {
      feedId: "feed-1",
      sourceName: "Example Feed",
      item: {
        title: "Example title",
        link: "https://example.com/post",
      },
      fetchedAt: new Date("2026-05-19T12:00:00.000Z"),
    });

    expect(result).toEqual({
      article: insertedArticle,
      created: true,
    });
  });

  it("should load the existing article when url conflict occurs", async () => {
    const existingArticle = {
      id: "article-1",
      url: "https://example.com/post",
    };
    const returning = async () => [];
    const onConflictDoNothing = () => ({ returning });
    const values = () => ({ onConflictDoNothing });
    const insert = () => ({ values });
    const findFirst = async () => existingArticle;
    const db = {
      insert,
      query: { articles: { findFirst } },
    } as never;

    const result = await insertFeedItem(db, {
      feedId: "feed-1",
      sourceName: "Example Feed",
      item: {
        title: "Example title",
        link: "https://example.com/post",
      },
      fetchedAt: new Date("2026-05-19T12:00:00.000Z"),
    });

    expect(result).toEqual({
      article: existingArticle,
      created: false,
    });
  });
});
