import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { articles, llmUsageLogs, schema } from "@vibeguard/db";
import {
  createOpenAIClient,
  decryptSecret,
  generateTags,
  summarizeText,
  translateText,
} from "@vibeguard/llm";
import {
  ArticleEcosystem,
  ArticleRiskCategory,
  ArticleStatus,
} from "@vibeguard/shared";

import {
  JobCancelledSignal,
  JobPausedSignal,
  processArticleJob,
  type ProcessArticleJobDependencies,
} from "./article-pipeline";
import {
  claimQueuedJobById,
  claimNextQueuedJob,
  countRunningJobs,
  buildJobPausedUpdate,
  markJobFailed,
  markJobStage,
  markJobSucceeded,
  resetStaleRunningJobs,
} from "./jobs";
import { fetchArticleHtml } from "@vibeguard/content/extract/article-html";
import { extractMarkdownFromHtml } from "@vibeguard/content";
import { JobStatus } from "@vibeguard/shared";

// 向后兼容：将 article-pipeline 模块的公共 API 重新导出，
// 使外部依赖 process-article 模块的调用方无需修改 import 路径。
export { buildLocalizedSummaryPrompt } from "@vibeguard/llm";
export {
  JobCancelledSignal,
  JobPausedSignal,
  processArticleJob,
} from "./article-pipeline";
export type { ProcessArticleJobDependencies } from "./article-pipeline";

type ContentDb = NodePgDatabase<typeof schema>;
type JobRecord = typeof schema.processingJobs.$inferSelect;
type ArticleRecord = typeof articles.$inferSelect;
type ArticlePatch = Partial<
  Pick<
    ArticleRecord,
    | "titleEn"
    | "titleZh"
    | "summaryEn"
    | "summaryZh"
    | "contentMdEn"
    | "contentMdZh"
    | "ecosystem"
    | "riskCategory"
    | "tags"
    | "contentHash"
    | "status"
    | "rawMeta"
  >
>;
const CANCELLED_JOB_MESSAGE = "任务已取消。";

// --- 数据库适配层：封装所有与数据库交互的底层操作 ---

async function markArticleStatus(
  db: ContentDb,
  articleId: string,
  status: (typeof ArticleStatus)[keyof typeof ArticleStatus],
  error?: string,
) {
  if (error) {
    await db
      .update(articles)
      .set({
        status,
        rawMeta: sql`COALESCE(${articles.rawMeta}, '{}'::jsonb) || ${JSON.stringify({ processingError: error })}::jsonb`,
      })
      .where(eq(articles.id, articleId));
  } else {
    await db.update(articles).set({ status }).where(eq(articles.id, articleId));
  }
}

async function updateArticleContent(
  db: ContentDb,
  articleId: string,
  content: {
    titleEn: string;
    titleZh: string;
    summaryEn: string;
    summaryZh: string;
    contentMdEn: string;
    contentMdZh: string;
    ecosystem: ArticleEcosystem;
    riskCategory: ArticleRiskCategory;
    tags: string[];
    contentHash: string;
    rawMeta: Record<string, unknown>;
  },
) {
  await db
    .update(articles)
    .set({
      titleEn: content.titleEn,
      titleZh: content.titleZh,
      summaryEn: content.summaryEn,
      summaryZh: content.summaryZh,
      contentMdEn: content.contentMdEn,
      contentMdZh: content.contentMdZh,
      ecosystem: content.ecosystem,
      riskCategory: content.riskCategory,
      tags: content.tags,
      contentHash: content.contentHash,
      rawMeta: content.rawMeta,
    })
    .where(eq(articles.id, articleId));
}

async function updateArticlePatch(
  db: ContentDb,
  articleId: string,
  patch: ArticlePatch,
) {
  await db.update(articles).set(patch).where(eq(articles.id, articleId));
}

async function logLlmUsage(
  db: ContentDb,
  input: {
    articleId: string;
    jobId?: string;
    taskType: string;
    model: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cachedTokens?: number;
      finishReason?: string;
    } | null;
    responseTimeMs: number;
  },
) {
  if (!input.usage) return;

  await db.insert(schema.llmUsageLogs).values({
    articleId: input.articleId,
    jobId: input.jobId ?? null,
    taskType: input.taskType,
    model: input.model,
    promptTokens: input.usage.promptTokens,
    completionTokens: input.usage.completionTokens,
    totalTokens: input.usage.totalTokens,
    cachedTokens: input.usage.cachedTokens ?? null,
    finishReason: input.usage.finishReason ?? null,
    responseTimeMs: input.responseTimeMs,
  });
}

async function deleteJob(db: ContentDb, jobId: string) {
  await db
    .delete(schema.processingJobs)
    .where(eq(schema.processingJobs.id, jobId));
}

async function checkClaimedJobControl(
  db: ContentDb,
  input: {
    jobId: string;
    articleId: string;
  },
) {
  const current = await db.query.processingJobs.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, input.jobId),
  });

  if (!current) {
    throw new JobCancelledSignal();
  }

  if (current.status === JobStatus.PAUSE_REQUESTED) {
    await markArticleStatus(db, input.articleId, ArticleStatus.PENDING);
    await db
      .update(schema.processingJobs)
      .set(buildJobPausedUpdate(new Date()))
      .where(eq(schema.processingJobs.id, input.jobId));
    throw new JobPausedSignal();
  }

  if (current.status === JobStatus.CANCEL_REQUESTED) {
    await markArticleStatus(
      db,
      input.articleId,
      ArticleStatus.FAILED,
      CANCELLED_JOB_MESSAGE,
    );
    await deleteJob(db, input.jobId);
    throw new JobCancelledSignal();
  }
}

// --- 已认领任务的核心处理流程 ---

async function processClaimedJob(db: ContentDb, job: JobRecord) {
  try {
    const checkJobControl = () =>
      checkClaimedJobControl(db, { jobId: job.id, articleId: job.articleId });

    await processArticleJob(job, {
      loadArticle: (articleId: string) =>
        db.query.articles.findFirst({
          where: (table, { eq: whereEq }) => whereEq(table.id, articleId),
        }),
      loadActiveLlmSettings: () =>
        db.query.llmSettings.findFirst({
          where: (table, { eq: whereEq }) => whereEq(table.isActive, true),
        }),
      markArticleStatus: (articleId, status, error) =>
        markArticleStatus(db, articleId, status, error),
      updateArticleContent: (articleId, content) =>
        updateArticleContent(db, articleId, content),
      updateArticlePatch: (articleId, patch) =>
        updateArticlePatch(db, articleId, patch),
      markJobStage: (stage) => markJobStage(db, job.id, stage),
      checkJobControl,
      logLlmUsage: (input) =>
        logLlmUsage(db, { ...input, jobId: input.jobId ?? job.id }),
      fetchArticleHtml,
      extractMarkdownFromHtml,
      createOpenAIClient,
      decryptSecret,
      translateText,
      summarizeText,
      generateTags,
    });

    await checkJobControl();
    await markJobSucceeded(db, job.id);

    return {
      jobId: job.id,
      articleId: job.articleId,
      status: "succeeded" as const,
    };
  } catch (error) {
    if (error instanceof JobPausedSignal) {
      return {
        jobId: job.id,
        articleId: job.articleId,
        status: "paused" as const,
      };
    }

    if (error instanceof JobCancelledSignal) {
      return {
        jobId: job.id,
        articleId: job.articleId,
        status: "cancelled" as const,
      };
    }

    const message = error instanceof Error ? error.message : String(error);

    try {
      await checkClaimedJobControl(db, {
        jobId: job.id,
        articleId: job.articleId,
      });
    } catch (secondary) {
      if (secondary instanceof JobPausedSignal) {
        return {
          jobId: job.id,
          articleId: job.articleId,
          status: "paused" as const,
        };
      }

      if (secondary instanceof JobCancelledSignal) {
        return {
          jobId: job.id,
          articleId: job.articleId,
          status: "cancelled" as const,
        };
      }
    }

    try {
      await markArticleStatus(db, job.articleId, ArticleStatus.FAILED, message);
    } catch (secondary) {
      // 仅记录日志，不抛出异常，避免掩盖原始错误信息
    }

    try {
      await markJobFailed(db, {
        jobId: job.id,
        attempt: job.attempt,
        maxAttempts: job.maxAttempts,
        error: message,
      });
    } catch (secondary) {
      // 仅记录日志，不抛出异常，避免掩盖原始错误信息
    }

    return {
      jobId: job.id,
      articleId: job.articleId,
      status: "failed" as const,
      error: message,
    };
  }
}

// --- 任务调度编排函数：负责从队列中领取任务并驱动处理流程 ---

export async function processNextQueuedJob(db: ContentDb) {
  const job = await claimNextQueuedJob(db);

  if (!job) {
    return null;
  }

  return processClaimedJob(db, job);
}

export async function processNextAvailableQueuedJob(
  db: ContentDb,
  maxRunningJobs: number,
) {
  const job = await claimNextQueuedJob(db, new Date(), { maxRunningJobs });

  if (!job) {
    return null;
  }

  return processClaimedJob(db, job);
}

export async function processQueuedJobById(db: ContentDb, jobId: string) {
  const job = await claimQueuedJobById(db, jobId);

  if (!job) {
    return null;
  }

  return processClaimedJob(db, job);
}

type ProcessedJobResult = NonNullable<
  Awaited<ReturnType<typeof processNextQueuedJob>>
>;

export type ProcessQueuedJobsOptions = {
  batchSize?: number;
  countRunningJobs?: typeof countRunningJobs;
  processNextJob?: typeof processNextQueuedJob;
  processJobById?: typeof processQueuedJobById;
  resetStaleJobs?: typeof resetStaleRunningJobs;
};

const DEFAULT_WORKER_BATCH_SIZE = 5;
const MAX_WORKER_BATCH_SIZE = 20;

export function resolveWorkerBatchSize(batchSize?: number) {
  if (!Number.isFinite(batchSize) || !batchSize || batchSize < 1) {
    return DEFAULT_WORKER_BATCH_SIZE;
  }

  return Math.min(Math.floor(batchSize), MAX_WORKER_BATCH_SIZE);
}

export async function processQueuedJobs(
  db: ContentDb,
  options: ProcessQueuedJobsOptions = {},
) {
  const results: ProcessedJobResult[] = [];
  const batchSize = resolveWorkerBatchSize(options.batchSize);
  const concurrency = Math.min(batchSize, 5);
  const processNextJob = options.processNextJob ?? processNextQueuedJob;
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs;
  let claimedSlots = 0;

  await resetStaleJobs(db);

  while (claimedSlots < batchSize) {
    const slotCount = Math.min(concurrency, batchSize - claimedSlots);
    claimedSlots += slotCount;
    const roundResults = await Promise.all(
      Array.from({ length: slotCount }, () => processNextJob(db)),
    );
    const processed = roundResults.filter(
      (result): result is ProcessedJobResult => Boolean(result),
    );

    results.push(...processed);

    if (processed.length < slotCount) {
      break;
    }
  }

  return results;
}

async function drainQueuedJobs(input: {
  db: ContentDb;
  concurrency: number;
  processNextJob: typeof processNextQueuedJob;
}) {
  const results: ProcessedJobResult[] = [];

  if (input.concurrency < 1) {
    return results;
  }

  const workers = Array.from({ length: input.concurrency }, async () => {
    while (true) {
      const result = await input.processNextJob(input.db);

      if (!result) {
        break;
      }

      results.push(result);
    }
  });

  await Promise.all(workers);

  return results;
}

export async function processAllRemainingJobs(
  db: ContentDb,
  options: ProcessQueuedJobsOptions = {},
) {
  const concurrency = Math.min(resolveWorkerBatchSize(options.batchSize), 5);
  const processNextJob = options.processNextJob ?? processNextQueuedJob;
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs;

  await resetStaleJobs(db);

  return drainQueuedJobs({ db, concurrency, processNextJob });
}

export async function processAvailableQueuedJobs(
  db: ContentDb,
  options: ProcessQueuedJobsOptions = {},
) {
  const maxConcurrency = Math.min(resolveWorkerBatchSize(options.batchSize), 5);
  const readRunningCount = options.countRunningJobs ?? countRunningJobs;
  const processNextJob =
    options.processNextJob ??
    ((nextDb: ContentDb) =>
      processNextAvailableQueuedJob(nextDb, maxConcurrency));
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs;

  await resetStaleJobs(db);

  const runningCount = await readRunningCount(db);
  const concurrency = Math.max(0, maxConcurrency - runningCount);

  return drainQueuedJobs({ db, concurrency, processNextJob });
}

export async function processQueuedJobsByIds(
  db: ContentDb,
  jobIds: string[],
  options: ProcessQueuedJobsOptions = {},
) {
  const results: ProcessedJobResult[] = [];
  const batchSize = resolveWorkerBatchSize(options.batchSize);
  const concurrency = Math.min(batchSize, 5);
  const processJobById = options.processJobById ?? processQueuedJobById;
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs;
  let cursor = 0;

  await resetStaleJobs(db);

  while (cursor < jobIds.length && results.length < batchSize) {
    const remainingSlots = batchSize - results.length;
    const chunkSize = Math.min(
      concurrency,
      remainingSlots,
      jobIds.length - cursor,
    );
    const chunk = jobIds.slice(cursor, cursor + chunkSize);
    cursor += chunkSize;
    const roundResults = await Promise.all(
      chunk.map((jobId) => processJobById(db, jobId)),
    );
    const processed = roundResults.filter(
      (result): result is ProcessedJobResult => Boolean(result),
    );

    results.push(...processed);
  }

  return results;
}
