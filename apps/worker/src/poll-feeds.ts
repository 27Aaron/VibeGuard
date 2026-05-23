import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { fetchFeed } from "@vibeguard/content/feed/fetch-feed";
import type { FeedItemInput } from "@vibeguard/content/feed/normalize";
import {
  insertFeedItem,
  type InsertFeedItemResult,
  type ToArticleInsertInput,
} from "@vibeguard/content/feed/store";
import { feeds, getDb, schema } from "@vibeguard/db";

import { enqueueExtractJob } from "./jobs";

type ContentDb = NodePgDatabase<typeof schema>;

export type ActiveFeed = typeof feeds.$inferSelect;

type ParsedFeed = {
  items?: FeedItemInput[] | null;
};

type PollFeedDependencies = {
  fetchFeed: (feedUrl: string) => Promise<ParsedFeed>;
  insertFeedItem: (input: ToArticleInsertInput) => Promise<InsertFeedItemResult>;
  enqueueExtractJob: (articleId: string) => Promise<unknown>;
  markFeedPoll: (
    feedId: string,
    state: {
      lastPolledAt: Date;
      lastSuccessAt?: Date;
    },
  ) => Promise<void>;
  now?: () => Date;
};

export async function listActiveFeeds(db: ContentDb = getDb()) {
  return db.query.feeds.findMany({
    where: eq(feeds.enabled, true),
  });
}

export async function markFeedPoll(
  db: ContentDb,
  feedId: string,
  state: {
    lastPolledAt: Date;
    lastSuccessAt?: Date;
  },
) {
  await db
    .update(feeds)
    .set({
      lastPolledAt: state.lastPolledAt,
      ...(state.lastSuccessAt
        ? { lastSuccessAt: state.lastSuccessAt }
        : {}),
    })
    .where(eq(feeds.id, feedId));
}

export function shouldPollFeed(feed: ActiveFeed, now = new Date()) {
  if (!feed.lastPolledAt) {
    return true;
  }

  if (
    typeof feed.pollIntervalMinutes !== "number" ||
    !Number.isFinite(feed.pollIntervalMinutes) ||
    feed.pollIntervalMinutes <= 0
  ) {
    return false;
  }

  const nextPollAt =
    feed.lastPolledAt.getTime() + feed.pollIntervalMinutes * 60 * 1000;

  return now.getTime() >= nextPollAt;
}

export async function pollFeed(
  feed: ActiveFeed,
  dependencies: PollFeedDependencies,
) {
  const polledAt = dependencies.now?.() ?? new Date();
  const items = [] as FeedItemInput[];
  let processedItemCount = 0;

  try {
    const parsedFeed = await dependencies.fetchFeed(feed.feedUrl);
    const feedItems = parsedFeed.items ?? [];

    processedItemCount = await processFeedItemsWithConcurrency(
      feedItems,
      feed.id,
      feed.name,
      polledAt,
      dependencies,
    );

    await dependencies.markFeedPoll(feed.id, {
      lastPolledAt: polledAt,
      lastSuccessAt: polledAt,
    });

    return {
      feedId: feed.id,
      processedItemCount,
      polledAt,
    };
  } catch (error) {
    await dependencies.markFeedPoll(feed.id, {
      lastPolledAt: polledAt,
    });

    throw error;
  }
}

const FEED_ITEM_CONCURRENCY = 5;

async function processFeedItemsWithConcurrency(
  items: FeedItemInput[],
  feedId: string,
  sourceName: string,
  fetchedAt: Date,
  dependencies: PollFeedDependencies,
): Promise<number> {
  let processed = 0;
  let cursor = 0;

  while (cursor < items.length) {
    const chunk = items.slice(cursor, cursor + FEED_ITEM_CONCURRENCY);
    cursor += chunk.length;

    const results = await Promise.all(
      chunk.map((item) =>
        dependencies.insertFeedItem({
          feedId,
          sourceName,
          item,
          fetchedAt,
        }),
      ),
    );

    const newArticles = results.filter((r) => r.created);
    await Promise.all(
      newArticles.map((r) => dependencies.enqueueExtractJob(r.article.id)),
    );

    processed += chunk.length;
  }

  return processed;
}

export async function pollFeedNow(
  feedId: string,
  dependencies: PollActiveFeedsDependencies = {},
) {
  const db = dependencies.db ?? getDb();
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  });

  if (!feed) {
    throw new Error("未找到该来源。");
  }

  if (!feed.enabled) {
    throw new Error("该来源已暂停，请先启用后再立即抓取。");
  }

  const cycleNow = dependencies.now?.() ?? new Date();
  const applyMarkFeedPoll =
    dependencies.markFeedPoll ??
    ((nextFeedId: string, state: { lastPolledAt: Date; lastSuccessAt?: Date }) =>
      markFeedPoll(db, nextFeedId, state));

  return pollFeed(feed, {
    fetchFeed: dependencies.fetchFeed ?? fetchFeed,
    insertFeedItem:
      dependencies.insertFeedItem ??
      ((input: ToArticleInsertInput) => insertFeedItem(db, input)),
    enqueueExtractJob:
      dependencies.enqueueExtractJob ??
      ((articleId: string) => enqueueExtractJob(db, articleId)),
    markFeedPoll: applyMarkFeedPoll,
    now: () => cycleNow,
  });
}

export type PollActiveFeedsDependencies = {
  db?: ContentDb;
  fetchFeed?: PollFeedDependencies["fetchFeed"];
  insertFeedItem?: PollFeedDependencies["insertFeedItem"];
  enqueueExtractJob?: PollFeedDependencies["enqueueExtractJob"];
  markFeedPoll?: PollFeedDependencies["markFeedPoll"];
  now?: PollFeedDependencies["now"];
};

const ACTIVE_FEED_CONCURRENCY = 5;

export async function pollActiveFeeds(
  dependencies: PollActiveFeedsDependencies = {},
) {
  const db = dependencies.db ?? getDb();
  const cycleNow = dependencies.now?.() ?? new Date();
  const activeFeeds = (await listActiveFeeds(db)).filter((feed) =>
    shouldPollFeed(feed, cycleNow),
  );
  const applyMarkFeedPoll =
    dependencies.markFeedPoll ??
    ((feedId: string, state: { lastPolledAt: Date; lastSuccessAt?: Date }) =>
      markFeedPoll(db, feedId, state));

  const succeeded: string[] = [];
  const failed: { feedId: string; error: string }[] = [];

  let cursor = 0;
  while (cursor < activeFeeds.length) {
    const chunk = activeFeeds.slice(cursor, cursor + ACTIVE_FEED_CONCURRENCY);
    cursor += chunk.length;

    const results = await Promise.allSettled(
      chunk.map((feed) =>
        pollFeed(feed, {
          fetchFeed: dependencies.fetchFeed ?? fetchFeed,
          insertFeedItem:
            dependencies.insertFeedItem ??
            ((input: ToArticleInsertInput) => insertFeedItem(db, input)),
          enqueueExtractJob:
            dependencies.enqueueExtractJob ??
            ((articleId: string) => enqueueExtractJob(db, articleId)),
          markFeedPoll: applyMarkFeedPoll,
          now: () => cycleNow,
        }).then(() => feed.id),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        failed.push({
          feedId: chunk[i].id,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    }
  }

  return {
    activeFeedCount: activeFeeds.length,
    succeeded,
    failed,
  };
}
