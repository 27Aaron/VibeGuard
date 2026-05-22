import { eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { articles, schema } from "@vibeguard/db"
import {
  createOpenAIClient,
  decryptSecret,
  generateTags,
  summarizeText,
  translateText,
} from "@vibeguard/llm"
import { ArticleStatus } from "@vibeguard/shared"

import {
  processArticleJob,
  type ProcessArticleJobDependencies,
} from "./article-pipeline"
import {
  claimQueuedJobById,
  claimNextQueuedJob,
  countRunningJobs,
  markJobFailed,
  markJobStage,
  markJobSucceeded,
  resetStaleRunningJobs,
} from "./jobs"
import { fetchArticleHtml } from "@vibeguard/content/extract/article-html"
import { extractMarkdownFromHtml } from "@vibeguard/content"

// Re-export public API from article-pipeline for backward compatibility
export { buildSummaryPrompt, processArticleJob } from "./article-pipeline"
export type { ProcessArticleJobDependencies } from "./article-pipeline"

type ContentDb = NodePgDatabase<typeof schema>
type JobRecord = typeof schema.processingJobs.$inferSelect
type ArticleRecord = typeof articles.$inferSelect
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
>

// --- DB adapter functions ---

async function markArticleStatus(
  db: ContentDb,
  articleId: string,
  status: typeof ArticleStatus[keyof typeof ArticleStatus],
  error?: string,
) {
  const currentArticle = await db.query.articles.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, articleId),
  })

  await db
    .update(articles)
    .set({
      status,
      rawMeta: error
        ? {
            ...(typeof currentArticle?.rawMeta === "object" && currentArticle?.rawMeta
              ? currentArticle.rawMeta
              : {}),
            processingError: error,
          }
        : currentArticle?.rawMeta ?? null,
    })
    .where(eq(articles.id, articleId))
}

async function updateArticleContent(
  db: ContentDb,
  articleId: string,
  content: {
    titleEn: string
    titleZh: string
    summaryEn: string
    summaryZh: string
    contentMdEn: string
    contentMdZh: string
    ecosystem: string
    riskCategory: string
    tags: string[]
    contentHash: string
    rawMeta: Record<string, unknown>
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
    .where(eq(articles.id, articleId))
}

async function updateArticlePatch(
  db: ContentDb,
  articleId: string,
  patch: ArticlePatch,
) {
  await db.update(articles).set(patch).where(eq(articles.id, articleId))
}

// --- processClaimedJob ---

async function processClaimedJob(db: ContentDb, job: JobRecord) {
  try {
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
      fetchArticleHtml,
      extractMarkdownFromHtml,
      createOpenAIClient,
      decryptSecret,
      translateText,
      summarizeText,
      generateTags,
    })

    await markJobSucceeded(db, job.id)

    return {
      jobId: job.id,
      articleId: job.articleId,
      status: "succeeded" as const,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await markArticleStatus(db, job.articleId, ArticleStatus.FAILED, message)
    await markJobFailed(db, {
      jobId: job.id,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      error: message,
    })

    return {
      jobId: job.id,
      articleId: job.articleId,
      status: "failed" as const,
      error: message,
    }
  }
}

// --- Orchestration functions ---

export async function processNextQueuedJob(db: ContentDb) {
  const job = await claimNextQueuedJob(db)

  if (!job) {
    return null
  }

  return processClaimedJob(db, job)
}

export async function processNextAvailableQueuedJob(
  db: ContentDb,
  maxRunningJobs: number,
) {
  const job = await claimNextQueuedJob(db, new Date(), { maxRunningJobs })

  if (!job) {
    return null
  }

  return processClaimedJob(db, job)
}

export async function processQueuedJobById(db: ContentDb, jobId: string) {
  const job = await claimQueuedJobById(db, jobId)

  if (!job) {
    return null
  }

  return processClaimedJob(db, job)
}

type ProcessedJobResult = NonNullable<Awaited<ReturnType<typeof processNextQueuedJob>>>

export type ProcessQueuedJobsOptions = {
  batchSize?: number
  countRunningJobs?: typeof countRunningJobs
  processNextJob?: typeof processNextQueuedJob
  processJobById?: typeof processQueuedJobById
  resetStaleJobs?: typeof resetStaleRunningJobs
}

const DEFAULT_WORKER_BATCH_SIZE = 5
const MAX_WORKER_BATCH_SIZE = 20

export function resolveWorkerBatchSize(batchSize?: number) {
  if (!Number.isFinite(batchSize) || !batchSize || batchSize < 1) {
    return DEFAULT_WORKER_BATCH_SIZE
  }

  return Math.min(Math.floor(batchSize), MAX_WORKER_BATCH_SIZE)
}

export async function processQueuedJobs(
  db: ContentDb,
  options: ProcessQueuedJobsOptions = {},
) {
  const results: ProcessedJobResult[] = []
  const batchSize = resolveWorkerBatchSize(options.batchSize)
  const concurrency = Math.min(batchSize, 5)
  const processNextJob = options.processNextJob ?? processNextQueuedJob
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs
  let claimedSlots = 0

  await resetStaleJobs(db)

  while (claimedSlots < batchSize) {
    const slotCount = Math.min(concurrency, batchSize - claimedSlots)
    claimedSlots += slotCount
    const roundResults = await Promise.all(
      Array.from({ length: slotCount }, () => processNextJob(db)),
    )
    const processed = roundResults.filter(
      (result): result is ProcessedJobResult => Boolean(result),
    )

    results.push(...processed)

    if (processed.length < slotCount) {
      break
    }
  }

  return results
}

async function drainQueuedJobs(input: {
  db: ContentDb
  concurrency: number
  processNextJob: typeof processNextQueuedJob
}) {
  const results: ProcessedJobResult[] = []

  if (input.concurrency < 1) {
    return results
  }

  const workers = Array.from({ length: input.concurrency }, async () => {
    while (true) {
      const result = await input.processNextJob(input.db)

      if (!result) {
        break
      }

      results.push(result)
    }
  })

  await Promise.all(workers)

  return results
}

export async function processAllRemainingJobs(
  db: ContentDb,
  options: ProcessQueuedJobsOptions = {},
) {
  const concurrency = Math.min(resolveWorkerBatchSize(options.batchSize), 5)
  const processNextJob = options.processNextJob ?? processNextQueuedJob
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs

  await resetStaleJobs(db)

  return drainQueuedJobs({ db, concurrency, processNextJob })
}

export async function processAvailableQueuedJobs(
  db: ContentDb,
  options: ProcessQueuedJobsOptions = {},
) {
  const maxConcurrency = Math.min(resolveWorkerBatchSize(options.batchSize), 5)
  const readRunningCount = options.countRunningJobs ?? countRunningJobs
  const processNextJob =
    options.processNextJob ??
    ((nextDb: ContentDb) =>
      processNextAvailableQueuedJob(nextDb, maxConcurrency))
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs

  await resetStaleJobs(db)

  const runningCount = await readRunningCount(db)
  const concurrency = Math.max(0, maxConcurrency - runningCount)

  return drainQueuedJobs({ db, concurrency, processNextJob })
}

export async function processQueuedJobsByIds(
  db: ContentDb,
  jobIds: string[],
  options: ProcessQueuedJobsOptions = {},
) {
  const results: ProcessedJobResult[] = []
  const batchSize = resolveWorkerBatchSize(options.batchSize)
  const concurrency = Math.min(batchSize, 5)
  const processJobById = options.processJobById ?? processQueuedJobById
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs
  let cursor = 0

  await resetStaleJobs(db)

  while (cursor < jobIds.length && results.length < batchSize) {
    const remainingSlots = batchSize - results.length
    const chunkSize = Math.min(concurrency, remainingSlots, jobIds.length - cursor)
    const chunk = jobIds.slice(cursor, cursor + chunkSize)
    cursor += chunkSize
    const roundResults = await Promise.all(
      chunk.map((jobId) => processJobById(db, jobId)),
    )
    const processed = roundResults.filter(
      (result): result is ProcessedJobResult => Boolean(result),
    )

    results.push(...processed)
  }

  return results
}
