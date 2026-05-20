import { and, desc, eq, gte, sql } from "drizzle-orm"

import { articles, getDb, processingJobs } from "@vibeguard/db"

import { formatDateTimeInShanghai } from "@/lib/time"

export const dynamic = "force-dynamic"

export async function GET() {
  const db = getDb()

  // 所有运行中 + 排队中的任务
  const activeJobs = await db
    .select({
      id: processingJobs.id,
      articleTitleZh: articles.titleZh,
      articleTitleEn: articles.titleEn,
      sourceName: articles.sourceName,
      jobType: processingJobs.jobType,
      status: processingJobs.status,
      pipelineStage: processingJobs.pipelineStage,
      attempt: processingJobs.attempt,
      maxAttempts: processingJobs.maxAttempts,
      startedAt: processingJobs.startedAt,
      updatedAt: processingJobs.updatedAt,
    })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .where(sql`${processingJobs.status} in ('running', 'queued')`)
    .orderBy(
      sql`CASE WHEN ${processingJobs.status} = 'running' THEN 0 ELSE 1 END`,
      desc(processingJobs.startedAt),
    )

  const running = activeJobs
    .filter((j) => j.status === "running")
    .map((job) => ({
      id: job.id,
      articleTitle: job.articleTitleZh || job.articleTitleEn,
      sourceName: job.sourceName,
      jobType: job.jobType,
      pipelineStage: job.pipelineStage,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      startedAt: job.startedAt
        ? formatDateTimeInShanghai(job.startedAt)
        : null,
      elapsed: job.startedAt
        ? Math.floor((Date.now() - job.startedAt.getTime()) / 1000)
        : null,
    }))

  const queued = activeJobs
    .filter((j) => j.status === "queued")
    .map((job) => ({
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
  const totalCount = running.length + queued.length

  return Response.json({
    running,
    queued,
    runningCount: running.length,
    queuedCount: queued.length,
    succeededCount,
    failedCount,
    totalCount,
  })
}
