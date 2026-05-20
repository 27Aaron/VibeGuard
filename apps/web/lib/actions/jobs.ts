"use server"

import { redirect } from "next/navigation"

import { eq, inArray, sql } from "drizzle-orm"

import { articles, getDb, processingJobs } from "@vibeguard/db"
import {
  ArticleStatus,
  JobPipelineStage,
  JobStatus,
} from "@vibeguard/shared"
import { processQueuedJobsByIds } from "worker"

import { normalizeUserFacingError } from "../errors"
import { resolveLang } from "../i18n"
import { buildSelectedJobsQueuedMessage } from "../job-action-messages"
import { revalidateLocalizedPaths } from "../revalidate"

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

  return `/${lang}/admin/jobs?${params.toString()}`
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

      processQueuedJobsByIds(db, [job.id], {
        batchSize: MANUAL_SINGLE_JOB_BATCH_SIZE,
      }).catch((error) => {
        console.error("[retryJob] background processing failed:", error)
      })

      revalidateLocalizedPaths("/admin", "/admin/articles", "/admin/jobs")

      redirectTarget = buildJobsRedirect(
        "success",
        lang === "zh"
          ? "已将该任务加入队列，后台正在处理中。"
          : "The job was queued — processing in background.",
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
    const matchedJobs = ids
      .map((id) => jobMap.get(id))
      .filter((job): job is NonNullable<typeof job> => Boolean(job))

    await Promise.all(
      matchedJobs.map((job) => queueJobForManualRun({ db, job })),
    )

    const queuedJobIds = matchedJobs.map((job) => job.id)

    processQueuedJobsByIds(db, queuedJobIds, {
      batchSize: MANUAL_SELECTED_JOB_BATCH_SIZE,
    }).catch((error) => {
      console.error("[retrySelectedJobs] background processing failed:", error)
    })

    revalidateLocalizedPaths("/admin", "/admin/articles", "/admin/jobs")

    redirectTarget = buildJobsRedirect(
      matchedJobs.length > 0 ? "success" : "error",
      matchedJobs.length > 0
        ? buildSelectedJobsQueuedMessage({
            lang,
            queuedCount: matchedJobs.length,
            backgroundStartLimit: MANUAL_SELECTED_JOB_BATCH_SIZE,
          })
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
