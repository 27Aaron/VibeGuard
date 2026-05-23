import { describe, expect, it, vi } from "vitest";

import { JobPipelineStage, JobStatus, JobType } from "@vibeguard/shared";

import {
  buildExtractJobInsert,
  buildJobFailureUpdate,
  buildStaleRunningJobUpdate,
  buildJobSuccessUpdate,
  markJobSucceeded,
} from "../../apps/worker/src/jobs";
import {
  processArticleJob,
  processAllRemainingJobs,
  processAvailableQueuedJobs,
  processQueuedJobs,
  processQueuedJobsByIds,
} from "../../apps/worker/src/process-article";
import {
  pollFeed,
  pollActiveFeeds,
  pollFeedNow,
  shouldPollFeed,
  type ActiveFeed,
} from "../../apps/worker/src/poll-feeds";
import { assertSuccessfulWorkerCycle, runWorkerLoop } from "../../apps/worker/src/index";

function createRelevantChatClient() {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  relevant: true,
                  reason: "security content",
                }),
              },
            },
          ],
        }),
      },
    },
  };
}

describe("buildExtractJobInsert", () => {
  it("should build a queued extract job payload", () => {
    const runAfter = new Date("2026-05-19T08:00:00.000Z");

    expect(
      buildExtractJobInsert({
        articleId: "article-1",
        runAfter,
      }),
    ).toEqual({
      articleId: "article-1",
      jobType: JobType.EXTRACT,
      status: JobStatus.QUEUED,
      pipelineStage: JobPipelineStage.WAITING,
      attempt: 0,
      maxAttempts: 3,
      runAfter,
    });
  });
});

describe("processArticleJob pipeline stages", () => {
  it("marks the exact extract pipeline stage before each processing step", async () => {
    const markJobStage = vi.fn().mockResolvedValue(undefined);
    const article = {
      id: "article-1",
      url: "https://example.com/article",
      sourceName: "Example",
      rawMeta: null,
    };
    const activeSettings = {
      apiKeyEncrypted: "encrypted-key",
      baseUrl: "https://llm.example.com/v1",
      model: "test-model",
      translateTitlePrompt: "translate title",
      translateContentPrompt: "translate content",
      summaryPromptEn: "summarize en",
      summaryPromptZh: "summarize zh",
    };

    await processArticleJob(
      { articleId: article.id, jobType: JobType.EXTRACT },
      {
        loadArticle: vi.fn().mockResolvedValue(article),
        loadActiveLlmSettings: vi.fn().mockResolvedValue(activeSettings),
        markArticleStatus: vi.fn().mockResolvedValue(undefined),
        updateArticleContent: vi.fn().mockResolvedValue(undefined),
        fetchArticleHtml: vi.fn().mockResolvedValue("<article>hello</article>"),
        extractMarkdownFromHtml: vi.fn().mockResolvedValue({
          title: "English title",
          contentMd: "English body",
          description: "Description",
          author: "Author",
          publishedAt: "2026-05-20T00:00:00.000Z",
          siteName: "Example",
        }),
        createOpenAIClient: vi.fn().mockReturnValue(createRelevantChatClient()),
        decryptSecret: vi.fn().mockReturnValue("plain-key"),
        translateText: vi.fn().mockResolvedValue("中文"),
        summarizeText: vi.fn().mockResolvedValue("summary"),
        markJobStage,
      } as never,
    );

    expect(markJobStage).toHaveBeenNthCalledWith(1, JobPipelineStage.FETCH_SOURCE);
    expect(markJobStage).toHaveBeenNthCalledWith(2, JobPipelineStage.EXTRACT_CONTENT);
    expect(markJobStage).toHaveBeenNthCalledWith(3, JobPipelineStage.CLASSIFY_RELEVANCE);
    expect(markJobStage).toHaveBeenNthCalledWith(4, JobPipelineStage.TRANSLATE_TITLE);
    expect(markJobStage).toHaveBeenNthCalledWith(5, JobPipelineStage.TRANSLATE_CONTENT);
    expect(markJobStage).toHaveBeenNthCalledWith(6, JobPipelineStage.SUMMARIZE_EN);
    expect(markJobStage).toHaveBeenNthCalledWith(7, JobPipelineStage.SUMMARIZE_ZH);
    expect(markJobStage).toHaveBeenNthCalledWith(8, JobPipelineStage.GENERATE_TAGS);
  });
});

describe("processQueuedJobs", () => {
  it("limits one worker cycle to five jobs by default", async () => {
    let callCount = 0
    const processNextJob = vi.fn().mockImplementation(() => {
      callCount += 1
      if (callCount > 10) return Promise.resolve(null)
      return Promise.resolve({
        jobId: `job-${callCount}`,
        articleId: `article-${callCount}`,
        status: "succeeded" as const,
      })
    })
    const resetStaleJobs = vi.fn().mockResolvedValue(undefined)

    const results = await processQueuedJobs({} as never, {
      processNextJob,
      resetStaleJobs,
    })

    expect(results).toHaveLength(5)
    expect(processNextJob).toHaveBeenCalledTimes(5)
    expect(resetStaleJobs).toHaveBeenCalledTimes(1)
  })

  it("allows callers to run a smaller manual batch", async () => {
    let callCount = 0
    const processNextJob = vi.fn().mockImplementation(() => {
      callCount += 1
      return Promise.resolve({
        jobId: `job-${callCount}`,
        articleId: `article-${callCount}`,
        status: "succeeded" as const,
      })
    })

    const results = await processQueuedJobs({} as never, {
      batchSize: 2,
      processNextJob,
      resetStaleJobs: vi.fn(),
    })

    expect(results.map((result) => result.jobId)).toEqual(["job-1", "job-2"])
    expect(processNextJob).toHaveBeenCalledTimes(2)
  })

  it("stops when no jobs are available", async () => {
    const processNextJob = vi.fn().mockResolvedValue(null)
    const resetStaleJobs = vi.fn().mockResolvedValue(undefined)

    const results = await processQueuedJobs({} as never, {
      processNextJob,
      resetStaleJobs,
    })

    expect(results).toHaveLength(0)
    expect(processNextJob).toHaveBeenCalledTimes(5) // one round
  })

  it("processes selected job ids directly in batch order", async () => {
    const processJobById = vi
      .fn()
      .mockImplementation((_db, jobId: string) =>
        Promise.resolve({
          jobId,
          articleId: `article-${jobId}`,
          status: "succeeded" as const,
        }),
      )

    const results = await processQueuedJobsByIds(
      {} as never,
      ["job-1", "job-2", "job-3"],
      {
        batchSize: 2,
        processJobById,
        resetStaleJobs: vi.fn(),
      },
    )

    expect(results.map((result) => result.jobId)).toEqual(["job-1", "job-2"])
    expect(processJobById).toHaveBeenCalledTimes(2)
  })

  it("continues past unavailable selected ids until the batch is filled", async () => {
    const processJobById = vi
      .fn()
      .mockImplementation((_db, jobId: string) => {
        if (jobId === "claimed-elsewhere") {
          return Promise.resolve(null)
        }

        return Promise.resolve({
          jobId,
          articleId: `article-${jobId}`,
          status: "succeeded" as const,
        })
      })

    const results = await processQueuedJobsByIds(
      {} as never,
      ["claimed-elsewhere", "job-1", "job-2"],
      {
        batchSize: 2,
        processJobById,
        resetStaleJobs: vi.fn(),
      },
    )

    expect(results.map((result) => result.jobId)).toEqual(["job-1", "job-2"])
    expect(processJobById).toHaveBeenCalledTimes(3)
  })

  it("drains the queue while refilling completed slots up to five concurrent jobs", async () => {
    let nextJob = 0
    let running = 0
    let peakRunning = 0
    const processNextJob = vi.fn().mockImplementation(async () => {
      nextJob += 1

      if (nextJob > 12) {
        return null
      }

      const jobId = `job-${nextJob}`
      running += 1
      peakRunning = Math.max(peakRunning, running)
      await Promise.resolve()
      running -= 1

      return {
        jobId,
        articleId: `article-${jobId}`,
        status: "succeeded" as const,
      }
    })

    const results = await processAllRemainingJobs({} as never, {
      batchSize: 5,
      processNextJob,
      resetStaleJobs: vi.fn(),
    })

    expect(results).toHaveLength(12)
    expect(peakRunning).toBeLessThanOrEqual(5)
    expect(processNextJob).toHaveBeenCalledTimes(17)
  })

  it("only fills available global running slots", async () => {
    let nextJob = 0
    let running = 0
    let peakRunning = 0
    const processNextJob = vi.fn().mockImplementation(async () => {
      nextJob += 1

      if (nextJob > 6) {
        return null
      }

      running += 1
      peakRunning = Math.max(peakRunning, running)
      await Promise.resolve()
      running -= 1

      return {
        jobId: `job-${nextJob}`,
        articleId: `article-${nextJob}`,
        status: "succeeded" as const,
      }
    })

    const results = await processAvailableQueuedJobs({} as never, {
      batchSize: 5,
      countRunningJobs: vi.fn().mockResolvedValue(3),
      processNextJob,
      resetStaleJobs: vi.fn(),
    })

    expect(results).toHaveLength(6)
    expect(peakRunning).toBeLessThanOrEqual(2)
  })

  it("does not claim new jobs when the global running limit is already full", async () => {
    const processNextJob = vi.fn()

    const results = await processAvailableQueuedJobs({} as never, {
      batchSize: 5,
      countRunningJobs: vi.fn().mockResolvedValue(5),
      processNextJob,
      resetStaleJobs: vi.fn(),
    })

    expect(results).toEqual([])
    expect(processNextJob).not.toHaveBeenCalled()
  })
})

describe("pollFeed", () => {
  const feed: ActiveFeed = {
    id: "feed-1",
    name: "Example Feed",
    siteUrl: "https://example.com",
    feedUrl: "https://example.com/feed.xml",
    feedType: "rss",
    enabled: true,
    pollIntervalMinutes: 30,
    lastPolledAt: null,
    lastSuccessAt: null,
    createdAt: new Date("2026-05-19T07:00:00.000Z"),
    updatedAt: new Date("2026-05-19T07:00:00.000Z"),
  };

  it("should insert each fetched item and enqueue an extract job", async () => {
    const now = new Date("2026-05-19T08:00:00.000Z");
    const insertedItems = [
      { article: { id: "article-1" }, created: true },
      { article: { id: "article-2" }, created: true },
    ];
    const insertFeedItem = vi
      .fn()
      .mockResolvedValueOnce(insertedItems[0])
      .mockResolvedValueOnce(insertedItems[1]);
    const enqueueExtractJob = vi.fn().mockResolvedValue(undefined);
    const markFeedPoll = vi.fn().mockResolvedValue(undefined);

    await pollFeed(feed, {
      fetchFeed: vi.fn().mockResolvedValue({
        items: [
          { title: "First", link: "https://example.com/1" },
          { title: "Second", link: "https://example.com/2" },
        ],
      }),
      insertFeedItem,
      enqueueExtractJob,
      markFeedPoll,
      now: () => now,
    });

    expect(insertFeedItem).toHaveBeenCalledTimes(2);
    expect(insertFeedItem).toHaveBeenNthCalledWith(1, {
      feedId: "feed-1",
      sourceName: "Example Feed",
      item: { title: "First", link: "https://example.com/1" },
      fetchedAt: now,
    });
    expect(insertFeedItem).toHaveBeenNthCalledWith(2, {
      feedId: "feed-1",
      sourceName: "Example Feed",
      item: { title: "Second", link: "https://example.com/2" },
      fetchedAt: now,
    });
    expect(enqueueExtractJob).toHaveBeenCalledTimes(2);
    expect(enqueueExtractJob).toHaveBeenNthCalledWith(1, "article-1");
    expect(enqueueExtractJob).toHaveBeenNthCalledWith(2, "article-2");
    expect(markFeedPoll).toHaveBeenCalledWith("feed-1", {
      lastPolledAt: now,
      lastSuccessAt: now,
    });
  });

  it("should not enqueue extraction again for existing feed items", async () => {
    const now = new Date("2026-05-19T08:00:00.000Z");
    const insertFeedItem = vi.fn().mockResolvedValue({
      article: { id: "article-existing" },
      created: false,
    });
    const enqueueExtractJob = vi.fn().mockResolvedValue(undefined);

    const result = await pollFeed(feed, {
      fetchFeed: vi.fn().mockResolvedValue({
        items: [{ title: "Existing", link: "https://example.com/existing" }],
      }),
      insertFeedItem,
      enqueueExtractJob,
      markFeedPoll: vi.fn().mockResolvedValue(undefined),
      now: () => now,
    });

    expect(result.processedItemCount).toBe(1);
    expect(enqueueExtractJob).not.toHaveBeenCalled();
  });

  it("should update lastPolledAt and lastSuccessAt after a successful poll", async () => {
    const now = new Date("2026-05-19T09:00:00.000Z");
    const markFeedPoll = vi.fn().mockResolvedValue(undefined);

    await pollFeed(feed, {
      fetchFeed: vi.fn().mockResolvedValue({ items: [] }),
      insertFeedItem: vi.fn(),
      enqueueExtractJob: vi.fn(),
      markFeedPoll,
      now: () => now,
    });

    expect(markFeedPoll).toHaveBeenCalledWith("feed-1", {
      lastPolledAt: now,
      lastSuccessAt: now,
    });
  });

  it("should update only lastPolledAt when the poll fails", async () => {
    const now = new Date("2026-05-19T10:00:00.000Z");
    const markFeedPoll = vi.fn().mockResolvedValue(undefined);

    await expect(
      pollFeed(feed, {
        fetchFeed: vi.fn().mockRejectedValue(new Error("feed fetch failed")),
        insertFeedItem: vi.fn(),
        enqueueExtractJob: vi.fn(),
        markFeedPoll,
        now: () => now,
      }),
    ).rejects.toThrow("feed fetch failed");

    expect(markFeedPoll).toHaveBeenCalledWith("feed-1", {
      lastPolledAt: now,
    });
  });
});

describe("buildJobFailureUpdate", () => {
  it("requeues a job with backoff while attempts remain", () => {
    const now = new Date("2026-05-19T08:00:00.000Z");

    expect(
      buildJobFailureUpdate({
        attempt: 1,
        maxAttempts: 3,
        now,
        error: "temporary failure",
      }),
    ).toEqual({
      status: JobStatus.QUEUED,
      lastError: "temporary failure",
      finishedAt: now,
      runAfter: new Date("2026-05-19T08:05:00.000Z"),
    });
  });

  it("marks a job failed after the final attempt", () => {
    const now = new Date("2026-05-19T08:00:00.000Z");

    expect(
      buildJobFailureUpdate({
        attempt: 3,
        maxAttempts: 3,
        now,
        error: "permanent failure",
      }),
    ).toEqual({
      status: JobStatus.FAILED,
      lastError: "permanent failure",
      finishedAt: now,
      runAfter: now,
    });
  });
});

describe("buildJobSuccessUpdate", () => {
  it("marks completed jobs with the completed pipeline stage", () => {
    const now = new Date("2026-05-19T08:00:00.000Z");

    expect(buildJobSuccessUpdate(now)).toEqual({
      status: JobStatus.SUCCEEDED,
      pipelineStage: JobPipelineStage.COMPLETED,
      finishedAt: now,
    });
  });

  it("preserves successful job rows for filtered task history and reruns", async () => {
    const now = new Date("2026-05-19T08:00:00.000Z");
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const del = vi.fn();

    await markJobSucceeded({ update, delete: del } as never, "job-1", now);

    expect(update).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(buildJobSuccessUpdate(now));
    expect(where).toHaveBeenCalledTimes(1);
  });
});

describe("buildStaleRunningJobUpdate", () => {
  it("requeues a stale running job while automatic attempts remain", () => {
    const now = new Date("2026-05-19T08:00:00.000Z");

    expect(
      buildStaleRunningJobUpdate({
        attempt: 2,
        maxAttempts: 3,
        now,
      }),
    ).toEqual({
      status: JobStatus.QUEUED,
      lastError: "任务执行超时，已自动重新排队。",
      finishedAt: now,
      runAfter: now,
    });
  });

  it("marks a stale running job failed after the third attempt", () => {
    const now = new Date("2026-05-19T08:00:00.000Z");

    expect(
      buildStaleRunningJobUpdate({
        attempt: 3,
        maxAttempts: 3,
        now,
      }),
    ).toEqual({
      status: JobStatus.FAILED,
      lastError: "任务执行超时，已达到 3 次自动尝试上限。",
      finishedAt: now,
      runAfter: now,
    });
  });
});

describe("pollActiveFeeds", () => {
  it("should skip feeds that have not reached their poll interval", async () => {
    const now = new Date("2026-05-19T08:00:00.000Z");
    const freshFeed: ActiveFeed = {
      id: "feed-fresh",
      name: "Fresh Feed",
      siteUrl: "https://example.com",
      feedUrl: "https://example.com/fresh.xml",
      feedType: "rss",
      enabled: true,
      pollIntervalMinutes: 30,
      lastPolledAt: new Date("2026-05-19T07:45:00.000Z"),
      lastSuccessAt: new Date("2026-05-19T07:45:00.000Z"),
      createdAt: new Date("2026-05-19T07:00:00.000Z"),
      updatedAt: new Date("2026-05-19T07:45:00.000Z"),
    };
    const staleFeed: ActiveFeed = {
      ...freshFeed,
      id: "feed-stale",
      name: "Stale Feed",
      feedUrl: "https://example.com/stale.xml",
      lastPolledAt: new Date("2026-05-19T07:00:00.000Z"),
      lastSuccessAt: new Date("2026-05-19T07:00:00.000Z"),
    };
    const db = {
      query: {
        feeds: {
          findMany: vi.fn().mockResolvedValue([freshFeed, staleFeed]),
        },
      },
    } as never;
    const fetchFeed = vi.fn().mockResolvedValue({ items: [] });
    const markFeedPoll = vi.fn().mockResolvedValue(undefined);

    const result = await pollActiveFeeds({
      db,
      fetchFeed,
      insertFeedItem: vi.fn(),
      enqueueExtractJob: vi.fn(),
      markFeedPoll,
      now: () => now,
    });

    expect(shouldPollFeed(freshFeed, now)).toBe(false);
    expect(shouldPollFeed(staleFeed, now)).toBe(true);
    expect(fetchFeed).toHaveBeenCalledTimes(1);
    expect(fetchFeed).toHaveBeenCalledWith("https://example.com/stale.xml");
    expect(result).toEqual({
      activeFeedCount: 1,
      succeeded: ["feed-stale"],
      failed: [],
    });
  });

  it("should continue polling remaining feeds after one feed fails", async () => {
    const feeds: ActiveFeed[] = [
      {
        id: "feed-ok",
        name: "Healthy Feed",
        siteUrl: "https://example.com",
        feedUrl: "https://example.com/healthy.xml",
        feedType: "rss",
        enabled: true,
        pollIntervalMinutes: 30,
        lastPolledAt: null,
        lastSuccessAt: null,
        createdAt: new Date("2026-05-19T07:00:00.000Z"),
        updatedAt: new Date("2026-05-19T07:00:00.000Z"),
      },
      {
        id: "feed-bad",
        name: "Broken Feed",
        siteUrl: "https://example.com",
        feedUrl: "https://example.com/broken.xml",
        feedType: "rss",
        enabled: true,
        pollIntervalMinutes: 30,
        lastPolledAt: null,
        lastSuccessAt: null,
        createdAt: new Date("2026-05-19T07:00:00.000Z"),
        updatedAt: new Date("2026-05-19T07:00:00.000Z"),
      },
    ];
    const db = {
      query: {
        feeds: {
          findMany: vi.fn().mockResolvedValue(feeds),
        },
      },
    } as never;
    const fetchFeed = vi
      .fn()
      .mockResolvedValueOnce({ items: [] })
      .mockRejectedValueOnce(new Error("feed fetch failed"));
    const markFeedPoll = vi.fn().mockResolvedValue(undefined);

    const result = await pollActiveFeeds({
      db,
      fetchFeed,
      insertFeedItem: vi.fn(),
      enqueueExtractJob: vi.fn(),
      markFeedPoll,
      now: () => new Date("2026-05-19T08:00:00.000Z"),
    });

    expect(result).toEqual({
      activeFeedCount: 2,
      succeeded: ["feed-ok"],
      failed: [
        {
          feedId: "feed-bad",
          error: "feed fetch failed",
        },
      ],
    });
    expect(fetchFeed).toHaveBeenCalledTimes(2);
    expect(markFeedPoll).toHaveBeenCalledTimes(2);
  });
});

describe("pollFeedNow", () => {
  it("should poll the selected feed immediately even if its interval has not elapsed", async () => {
    const feed: ActiveFeed = {
      id: "feed-now",
      name: "Immediate Feed",
      siteUrl: "https://example.com",
      feedUrl: "https://example.com/immediate.xml",
      feedType: "rss",
      enabled: true,
      pollIntervalMinutes: 30,
      lastPolledAt: new Date("2026-05-19T07:55:00.000Z"),
      lastSuccessAt: new Date("2026-05-19T07:55:00.000Z"),
      createdAt: new Date("2026-05-19T07:00:00.000Z"),
      updatedAt: new Date("2026-05-19T07:55:00.000Z"),
    };
    const now = new Date("2026-05-19T08:00:00.000Z");
    const db = {
      query: {
        feeds: {
          findFirst: vi.fn().mockResolvedValue(feed),
        },
      },
    } as never;
    const insertFeedItem = vi.fn().mockResolvedValue({
      article: { id: "article-1" },
      created: true,
    });
    const enqueueExtractJob = vi.fn().mockResolvedValue(undefined);
    const markFeedPoll = vi.fn().mockResolvedValue(undefined);

    const result = await pollFeedNow(feed.id, {
      db,
      fetchFeed: vi.fn().mockResolvedValue({
        items: [{ title: "Immediate article", link: "https://example.com/article" }],
      }),
      insertFeedItem,
      enqueueExtractJob,
      markFeedPoll,
      now: () => now,
    });

    expect(result).toEqual({
      feedId: feed.id,
      processedItemCount: 1,
      polledAt: now,
    });
    expect(insertFeedItem).toHaveBeenCalledTimes(1);
    expect(enqueueExtractJob).toHaveBeenCalledWith("article-1");
    expect(markFeedPoll).toHaveBeenCalledWith(feed.id, {
      lastPolledAt: now,
      lastSuccessAt: now,
    });
  });

  it("should reject unknown feeds", async () => {
    const db = {
      query: {
        feeds: {
          findFirst: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as never;

    await expect(pollFeedNow("missing-feed", { db })).rejects.toThrow(
      "未找到该来源。",
    );
  });

  it("should reject paused feeds", async () => {
    const feed: ActiveFeed = {
      id: "feed-paused",
      name: "Paused Feed",
      siteUrl: "https://example.com",
      feedUrl: "https://example.com/paused.xml",
      feedType: "rss",
      enabled: false,
      pollIntervalMinutes: 30,
      lastPolledAt: null,
      lastSuccessAt: null,
      createdAt: new Date("2026-05-19T07:00:00.000Z"),
      updatedAt: new Date("2026-05-19T07:00:00.000Z"),
    };
    const db = {
      query: {
        feeds: {
          findFirst: vi.fn().mockResolvedValue(feed),
        },
      },
    } as never;

    await expect(pollFeedNow(feed.id, { db })).rejects.toThrow(
      "该来源已暂停，请先启用后再立即抓取。",
    );
  });
});

describe("assertSuccessfulWorkerCycle", () => {
  it("logs a warning when some feeds fail without throwing", () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    expect(() =>
      assertSuccessfulWorkerCycle(
        {
          activeFeedCount: 2,
          succeeded: ["feed-ok"],
          failed: [{ feedId: "feed-bad", error: "feed fetch failed" }],
          processedJobs: [],
        },
        logger,
      ),
    ).not.toThrow();
    expect(logger.log).toHaveBeenCalledWith(
      "worker cycle complete: 1/2 feeds succeeded",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "worker cycle warnings: feed-bad: feed fetch failed",
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("runWorkerLoop", () => {
  it("keeps running worker cycles until stopped", async () => {
    const controller = new AbortController()
    const summary = {
      activeFeedCount: 0,
      succeeded: [],
      failed: [],
      processedJobs: [],
    }
    const runCycle = vi.fn().mockImplementation(async () => {
      if (runCycle.mock.calls.length >= 2) {
        controller.abort()
      }

      return summary
    })
    const sleep = vi.fn().mockResolvedValue(undefined)
    const logger = { log: vi.fn(), error: vi.fn() }

    await runWorkerLoop({
      intervalMs: 10,
      logger,
      runCycle,
      signal: controller.signal,
      sleep,
    })

    expect(runCycle).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it("treats feed-level failures as warnings instead of loop errors", async () => {
    const controller = new AbortController()
    const runCycle = vi.fn().mockImplementation(async () => {
      controller.abort()

      return {
        activeFeedCount: 2,
        succeeded: ["feed-ok"],
        failed: [{ feedId: "feed-bad", error: "404 Not Found" }],
        processedJobs: [],
      }
    })
    const sleep = vi.fn().mockResolvedValue(undefined)
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }

    await runWorkerLoop({
      intervalMs: 10,
      logger,
      runCycle,
      signal: controller.signal,
      sleep,
    })

    expect(logger.warn).toHaveBeenCalledWith(
      "worker cycle warnings: feed-bad: 404 Not Found",
    )
    expect(logger.error).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
  })
})
