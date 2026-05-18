"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { eq, inArray, sql } from "drizzle-orm"

import { articles, getDb, processingJobs } from "@content-foundation/db"
import {
  ArticleStatus,
  JobPipelineStage,
  JobStatus,
} from "@content-foundation/shared"
import { processQueuedJobsByIds } from "ingestion-worker"

import { normalizeUserFacingError } from "../errors"
import { resolveLang } from "../i18n"

const MANUAL_SELECTED_JOB_BATCH_SIZE = 5
const MANUAL_SINGLE_JOB_BATCH_SIZE = 1

type JobsRedirectContext = {
  status?: string
  stage?: string
  page?: string
  pageSize?: string
}

function buildJobsRedirect(
  result: "success" | "error",
  message: string,
  lang: "zh" | "en",
  context: JobsRedirectContext = {},
) {
  const params = new URLSearchParams({
    result,
    message,
    lang,
  })

  if (context.status && context.status !== "all") {
    params.set("status", context.status)
  }

  if (context.stage && context.stage !== "all") {
    params.set("stage", context.stage)
  }

  if (context.page) {
    params.set("page", context.page)
  }

  if (context.pageSize) {
    params.set("pageSize", context.pageSize)
  }

  return `/admin/jobs?${params.toString()}`
}

function getJobsRedirectContext(formData: FormData): JobsRedirectContext {
  return {
    status: String(formData.get("status") ?? "all"),
    stage: String(formData.get("stage") ?? "all"),
    page: String(formData.get("page") ?? "1"),
    pageSize: String(formData.get("pageSize") ?? "10"),
  }
}

async function queueJobForManualRun(input: {
  db: ReturnType<typeof getDb>
  job: typeof processingJobs.$inferSelect
}) {
  const clearGeneratedContent = input.job.status === JobStatus.SUCCEEDED

  await input.db
    .update(processingJobs)
    .set({
      status: JobStatus.QUEUED,
      pipelineStage: JobPipelineStage.WAITING,
      maxAttempts: input.job.maxAttempts + 3,
      runAfter: new Date(),
      startedAt: null,
      finishedAt: null,
      lastError: null,
    })
    .where(eq(processingJobs.id, input.job.id))

  await input.db
    .update(articles)
    .set({
      status: ArticleStatus.PENDING,
      ...(clearGeneratedContent
        ? {
            titleZh: null,
            summaryEn: null,
            summaryZh: null,
            contentMdEn: null,
            contentMdZh: null,
            ecosystem: "unknown",
            riskCategory: "unknown",
            tags: [],
            contentHash: null,
          }
        : {}),
      rawMeta: sql`CASE
        WHEN ${articles.rawMeta} IS NULL THEN NULL
        ELSE ${articles.rawMeta} - 'processingError'
      END`,
    })
    .where(eq(articles.id, input.job.articleId))
}

export async function retryJobAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const jobId = String(formData.get("id") ?? "").trim()
  const redirectContext = getJobsRedirectContext(formData)

  if (!jobId) {
    redirect(
      buildJobsRedirect(
        "error",
        lang === "zh" ? "缺少任务 ID。" : "Missing job ID.",
        lang,
        redirectContext,
      ),
    )
  }

  let redirectTarget = buildJobsRedirect(
    "error",
    lang === "zh" ? "执行任务失败。" : "Failed to run the job.",
    lang,
    redirectContext,
  )

  try {
    const db = getDb()
    const job = await db.query.processingJobs.findFirst({
      where: eq(processingJobs.id, jobId),
    })

    if (!job) {
      redirectTarget = buildJobsRedirect(
        "error",
        lang === "zh" ? "未找到对应任务。" : "Job not found.",
        lang,
        redirectContext,
      )
    } else {
      await queueJobForManualRun({ db, job })
      const processedJobs = await processQueuedJobsByIds(db, [job.id], {
        batchSize: MANUAL_SINGLE_JOB_BATCH_SIZE,
      })

      revalidatePath("/admin")
      revalidatePath("/admin/articles")
      revalidatePath("/admin/jobs")

      redirectTarget = buildJobsRedirect(
        "success",
        lang === "zh"
          ? `已将该任务加入队列，并立即处理了 ${processedJobs.length} 个任务。`
          : `The job was queued and ${processedJobs.length} job was processed immediately.`,
        lang,
        redirectContext,
      )
    }
  } catch (error) {
    redirectTarget = buildJobsRedirect(
      "error",
      normalizeUserFacingError(error, lang),
      lang,
      redirectContext,
    )
  }

  redirect(redirectTarget)
}

export async function retryFailedJobsAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const redirectContext = getJobsRedirectContext(formData)
  let redirectTarget = buildJobsRedirect(
    "error",
    lang === "zh" ? "批量重试失败任务失败。" : "Failed to retry failed jobs.",
    lang,
    redirectContext,
  )

  try {
    const db = getDb()
    const failedJobs = await db.query.processingJobs.findMany({
      where: eq(processingJobs.status, JobStatus.FAILED),
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
      limit: 50,
    })

    if (failedJobs.length === 0) {
      redirectTarget = buildJobsRedirect(
        "error",
        lang === "zh"
          ? "当前没有可继续执行的失败任务。"
          : "There are no failed jobs available to continue.",
        lang,
        redirectContext,
      )
    } else {
      let enqueuedCount = 0

      for (const job of failedJobs) {
        await queueJobForManualRun({ db, job })
        enqueuedCount += 1
      }
      const processedJobs = await processQueuedJobsByIds(
        db,
        failedJobs.map((job) => job.id),
        { batchSize: MANUAL_SELECTED_JOB_BATCH_SIZE },
      )

      revalidatePath("/admin")
      revalidatePath("/admin/articles")
      revalidatePath("/admin/jobs")

      redirectTarget = buildJobsRedirect(
        enqueuedCount > 0 ? "success" : "error",
        enqueuedCount > 0
          ? lang === "zh"
            ? `已继续执行 ${enqueuedCount} 个失败任务，本轮立即处理 ${processedJobs.length} 个。`
            : `${enqueuedCount} failed jobs were continued, and ${processedJobs.length} were processed immediately.`
          : lang === "zh"
            ? "当前没有可继续执行的失败任务。"
            : "There are no failed jobs available to continue.",
        lang,
        redirectContext,
      )
    }
  } catch (error) {
    redirectTarget = buildJobsRedirect(
      "error",
      normalizeUserFacingError(error, lang),
      lang,
      redirectContext,
    )
  }

  redirect(redirectTarget)
}

export async function retrySelectedJobsAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const redirectContext = getJobsRedirectContext(formData)
  const ids = formData
    .getAll("ids")
    .map((id) => String(id).trim())
    .filter(Boolean)
  let redirectTarget = buildJobsRedirect(
    "error",
    lang === "zh"
      ? "请先选择要执行的任务。"
      : "Select jobs to run first.",
    lang,
    redirectContext,
  )

  if (ids.length === 0) {
    redirect(redirectTarget)
  }

  try {
    const db = getDb()
    const jobs = await db.query.processingJobs.findMany({
      where: inArray(processingJobs.id, ids),
    })
    const jobMap = new Map(jobs.map((job) => [job.id, job]))
    const queuedJobIds = []
    let enqueuedCount = 0

    for (const id of ids) {
      const job = jobMap.get(id)

      if (!job) {
        continue
      }

      await queueJobForManualRun({ db, job })
      queuedJobIds.push(job.id)
      enqueuedCount += 1
    }
    const processedJobs = await processQueuedJobsByIds(db, queuedJobIds, {
      batchSize: MANUAL_SELECTED_JOB_BATCH_SIZE,
    })

    revalidatePath("/admin")
    revalidatePath("/admin/articles")
    revalidatePath("/admin/jobs")

    redirectTarget = buildJobsRedirect(
      enqueuedCount > 0 ? "success" : "error",
      enqueuedCount > 0
        ? lang === "zh"
          ? `已将 ${enqueuedCount} 个任务加入处理队列，本轮立即处理 ${processedJobs.length} 个。`
          : `${enqueuedCount} jobs were queued, and ${processedJobs.length} were processed immediately.`
        : lang === "zh"
          ? "选中的任务没有可执行项。"
          : "The selected jobs did not include runnable items.",
      lang,
      redirectContext,
    )
  } catch (error) {
    redirectTarget = buildJobsRedirect(
      "error",
      normalizeUserFacingError(error, lang),
      lang,
      redirectContext,
    )
  }

  redirect(redirectTarget)
}
