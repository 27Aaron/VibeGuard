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

  const nextPollAt =
    feed.lastPolledAt.getTime() + feed.pollIntervalMinutes * 60 * 1000;

  return now.getTime() >= nextPollAt;
}

export async function pollFeed(
  feed: ActiveFeed,
  dependencies: PollFeedDependencies,
) {
  const polledAt = dependencies.now?.() ?? new Date();
  let processedItemCount = 0;

  try {
    const parsedFeed = await dependencies.fetchFeed(feed.feedUrl);

    for (const item of parsedFeed.items ?? []) {
      const result = await dependencies.insertFeedItem({
        feedId: feed.id,
        sourceName: feed.name,
        item,
        fetchedAt: polledAt,
      });

      if (result.created) {
        await dependencies.enqueueExtractJob(result.article.id);
      }

      processedItemCount += 1;
    }

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

  const succeeded = [];
  const failed = [];

  for (const feed of activeFeeds) {
    try {
      await pollFeed(feed, {
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
      succeeded.push(feed.id);
    } catch (error) {
      failed.push({
        feedId: feed.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    activeFeedCount: activeFeeds.length,
    succeeded,
    failed,
  };
}
