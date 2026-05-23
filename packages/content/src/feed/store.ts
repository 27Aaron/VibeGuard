import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { articles, schema } from "@vibeguard/db";
import { ArticleStatus } from "@vibeguard/shared";

import { classifySecurityContent } from "../classify";
import { normalizeFeedItem, type FeedItemInput } from "./normalize";

type ContentDb = NodePgDatabase<typeof schema>;

export type ToArticleInsertInput = {
  feedId: string;
  sourceName: string;
  item: FeedItemInput;
  fetchedAt?: Date;
};

export type InsertFeedItemResult = {
  article: typeof articles.$inferSelect;
  created: boolean;
};

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildArticleInsert({
  feedId,
  sourceName,
  item,
  fetchedAt = new Date(),
}: ToArticleInsertInput) {
  const normalized = normalizeFeedItem(item, fetchedAt);
  const rawContent = typeof item.content === "string" ? item.content : undefined;
  const summaryText =
    typeof item.contentSnippet === "string"
      ? item.contentSnippet
      : rawContent
        ? stripHtmlTags(rawContent)
        : undefined;
  const classification = classifySecurityContent({
    sourceName,
    url: normalized.url,
    title: normalized.titleEn,
    summary: summaryText,
    categories: item.categories,
  })

  return {
    feedId,
    sourceName: sourceName.trim(),
    url: normalized.url,
    titleEn: normalized.titleEn,
    ecosystem: classification.ecosystem,
    riskCategory: classification.riskCategory,
    tags: classification.tags,
    publishedAt: normalized.publishedAt,
    publishedAtIsFallback: normalized.publishedAtIsFallback,
    fetchedAt: normalized.fetchedAt,
    status: ArticleStatus.PENDING,
    rawMeta: normalized.rawMeta,
  };
}

export async function insertFeedItem(
  db: ContentDb,
  input: ToArticleInsertInput,
): Promise<InsertFeedItemResult> {
  const article = buildArticleInsert(input);
  const inserted = await db
    .insert(articles)
    .values(article)
    .onConflictDoNothing({ target: articles.url })
    .returning();

  if (inserted[0]) {
    return {
      article: inserted[0],
      created: true,
    };
  }

  const existing = await db.query.articles.findFirst({
    where: eq(articles.url, article.url),
  });

  if (!existing) {
    throw new Error(`Unable to load article after insert attempt: ${article.url}`);
  }

  return {
    article: existing,
    created: false,
  };
}
