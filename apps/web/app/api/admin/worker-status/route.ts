import { and, desc, eq, gte, sql } from "drizzle-orm"

import { articles, getDb, processingJobs } from "@vibeguard/db"

import { formatDateTimeInShanghai } from "@/lib/time"

export const dynamic = "force-dynamic"
const WORKER_STATUS_LIST_LIMIT = 200

export async function GET() {
  const db = getDb()

  const [runningCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(processingJobs)
    .where(eq(processingJobs.status, "running"))

  const [queuedCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(processingJobs)
    .where(eq(processingJobs.status, "queued"))

  const runningJobs = await db
    .select({
      id: processingJobs.id,
      articleTitleZh: articles.titleZh,
      articleTitleEn: articles.titleEn,
      sourceName: articles.sourceName,
      jobType: processingJobs.jobType,
      pipelineStage: processingJobs.pipelineStage,
      attempt: processingJobs.attempt,
      maxAttempts: processingJobs.maxAttempts,
      startedAt: processingJobs.startedAt,
    })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .where(eq(processingJobs.status, "running"))
    .orderBy(desc(processingJobs.startedAt))
    .limit(WORKER_STATUS_LIST_LIMIT / 2)

  const queuedJobs = await db
    .select({
      id: processingJobs.id,
      articleTitleZh: articles.titleZh,
      articleTitleEn: articles.titleEn,
      sourceName: articles.sourceName,
      jobType: processingJobs.jobType,
      attempt: processingJobs.attempt,
      maxAttempts: processingJobs.maxAttempts,
    })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .where(eq(processingJobs.status, "queued"))
    .orderBy(desc(processingJobs.updatedAt))
    .limit(WORKER_STATUS_LIST_LIMIT / 2)

  const runningCount = Number(runningCountRow?.count ?? 0)
  const queuedCount = Number(queuedCountRow?.count ?? 0)

  const running = runningJobs.map((job) => ({
      id: job.id,
      articleTitle: job.articleTitleZh || job.articleTitleEn,
      sourceName: job.sourceName,
      jobType: job.jobType,
      pipelineStage: job.pipelineStage || "waiting",
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      startedAt: job.startedAt
        ? formatDateTimeInShanghai(job.startedAt)
        : null,
      elapsed: job.startedAt
        ? Math.floor((Date.now() - job.startedAt.getTime()) / 1000)
        : null,
  }))

  const queued = queuedJobs.map((job) => ({
    id: job.id,
    articleTitle: job.articleTitleZh || job.articleTitleEn,
    sourceName: job.sourceName,
    jobType: job.jobType,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
  }))

  // 最近 5 分钟内完成/失败的任务（本轮统计）
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const [succeededRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.status, "succeeded"),
        gte(processingJobs.updatedAt, fiveMinutesAgo),
      ),
    )
  const [failedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.status, "failed"),
        gte(processingJobs.updatedAt, fiveMinutesAgo),
      ),
    )

  const succeededCount = Number(succeededRow?.count ?? 0)
  const failedCount = Number(failedRow?.count ?? 0)
  const totalCount = runningCount + queuedCount

  return Response.json({
    running,
    queued,
    runningCount,
    queuedCount,
    succeededCount,
    failedCount,
    totalCount,
  })
}
