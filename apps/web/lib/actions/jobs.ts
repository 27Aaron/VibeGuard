"use server"

import { redirect } from "next/navigation"

import { eq, inArray, sql } from "drizzle-orm"

import { articles, getDb, processingJobs } from "@vibeguard/db"
import {
  ArticleStatus,
  JobPipelineStage,
  JobStatus,
} from "@vibeguard/shared"

import { normalizeUserFacingError } from "../errors"
import { resolveLang } from "../i18n"
import { buildSelectedJobsQueuedMessage } from "../job-action-messages"
import { revalidateLocalizedPaths } from "../revalidate"

const MANUAL_SELECTED_JOB_BATCH_SIZE = 5
const CANCELLED_JOB_MESSAGE = "任务已取消。"

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

function buildJobPauseRequestedUpdate(now = new Date()) {
  return {
    status: JobStatus.PAUSE_REQUESTED,
    lastError: "用户请求暂停，当前步骤完成后暂停。",
    updatedAt: now,
  }
}

function buildJobPausedUpdate(now = new Date()) {
  return {
    status: JobStatus.PAUSED,
    startedAt: null,
    finishedAt: null,
    lastError: "任务已暂停，可稍后恢复。",
    updatedAt: now,
  }
}

function buildJobResumeUpdate(now = new Date()) {
  return {
    status: JobStatus.QUEUED,
    startedAt: null,
    finishedAt: null,
    runAfter: now,
    lastError: null,
    updatedAt: now,
  }
}

async function markArticleCancelled(input: {
  db: ReturnType<typeof getDb>
  articleId: string
}) {
  await input.db
    .update(articles)
    .set({
      status: ArticleStatus.FAILED,
      rawMeta: sql`COALESCE(${articles.rawMeta}, '{}'::jsonb) || ${JSON.stringify({ processingError: CANCELLED_JOB_MESSAGE })}::jsonb`,
    })
    .where(eq(articles.id, input.articleId))
}

async function pauseJobForManualControl(input: {
  db: ReturnType<typeof getDb>
  job: typeof processingJobs.$inferSelect
}) {
  const now = new Date()

  if (input.job.status === JobStatus.QUEUED) {
    await input.db
      .update(processingJobs)
      .set(buildJobPausedUpdate(now))
      .where(eq(processingJobs.id, input.job.id))
    return true
  }

  if (input.job.status === JobStatus.RUNNING) {
    await input.db
      .update(processingJobs)
      .set(buildJobPauseRequestedUpdate(now))
      .where(eq(processingJobs.id, input.job.id))
    return true
  }

  return false
}

async function resumeJobForManualControl(input: {
  db: ReturnType<typeof getDb>
  job: typeof processingJobs.$inferSelect
}) {
  if (input.job.status !== JobStatus.PAUSED) {
    return false
  }

  await input.db
    .update(processingJobs)
    .set(buildJobResumeUpdate(new Date()))
    .where(eq(processingJobs.id, input.job.id))
  return true
}

async function cancelJobForManualControl(input: {
  db: ReturnType<typeof getDb>
  job: typeof processingJobs.$inferSelect
}) {
  if (
    input.job.status === JobStatus.QUEUED ||
    input.job.status === JobStatus.PAUSED ||
    input.job.status === JobStatus.FAILED
  ) {
    await markArticleCancelled({ db: input.db, articleId: input.job.articleId })
    await input.db
      .delete(processingJobs)
      .where(eq(processingJobs.id, input.job.id))
    return true
  }

  if (
    input.job.status === JobStatus.RUNNING ||
    input.job.status === JobStatus.PAUSE_REQUESTED
  ) {
    await input.db
      .update(processingJobs)
      .set({
        status: JobStatus.CANCEL_REQUESTED,
        lastError: "用户请求取消，当前步骤结束后清理任务。",
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, input.job.id))
    return true
  }

  return false
}

async function loadSelectedJobs(db: ReturnType<typeof getDb>, ids: string[]) {
  const jobs = await db.query.processingJobs.findMany({
    where: inArray(processingJobs.id, ids),
  })
  const jobMap = new Map(jobs.map((job) => [job.id, job]))

  return ids
    .map((id) => jobMap.get(id))
    .filter((job): job is NonNullable<typeof job> => Boolean(job))
}

async function runSingleJobControlAction(
  formData: FormData,
  input: {
    fallbackMessage: string
    missingMessage: string
    successMessage: string
    emptyMessage: string
    operation: (operationInput: {
      db: ReturnType<typeof getDb>
      job: typeof processingJobs.$inferSelect
    }) => Promise<boolean>
  },
) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const jobId = String(formData.get("id") ?? "").trim()
  const redirectContext = getJobsRedirectContext(formData)

  if (!jobId) {
    redirect(buildJobsRedirect("error", input.missingMessage, lang, redirectContext))
  }

  let redirectTarget = buildJobsRedirect(
    "error",
    input.fallbackMessage,
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
      const changed = await input.operation({ db, job })

      revalidateLocalizedPaths("/admin", "/admin/articles", "/admin/jobs")
      redirectTarget = buildJobsRedirect(
        changed ? "success" : "error",
        changed ? input.successMessage : input.emptyMessage,
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

async function runSelectedJobControlAction(
  formData: FormData,
  input: {
    emptySelectionMessage: string
    successMessage: (count: number) => string
    emptyRunnableMessage: string
    operation: (operationInput: {
      db: ReturnType<typeof getDb>
      job: typeof processingJobs.$inferSelect
    }) => Promise<boolean>
  },
) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const redirectContext = getJobsRedirectContext(formData)
  const ids = formData
    .getAll("ids")
    .map((id) => String(id).trim())
    .filter(Boolean)
  let redirectTarget = buildJobsRedirect(
    "error",
    input.emptySelectionMessage,
    lang,
    redirectContext,
  )

  if (ids.length === 0) {
    redirect(redirectTarget)
  }

  try {
    const db = getDb()
    const matchedJobs = await loadSelectedJobs(db, ids)
    let changedCount = 0

    for (const job of matchedJobs) {
      if (await input.operation({ db, job })) {
        changedCount += 1
      }
    }

    revalidateLocalizedPaths("/admin", "/admin/articles", "/admin/jobs")
    redirectTarget = buildJobsRedirect(
      changedCount > 0 ? "success" : "error",
      changedCount > 0
        ? input.successMessage(changedCount)
        : input.emptyRunnableMessage,
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

      revalidateLocalizedPaths("/admin", "/admin/articles", "/admin/jobs")

      redirectTarget = buildJobsRedirect(
        "success",
        lang === "zh"
          ? "已将该任务加入队列，常驻 Worker 会按最多 5 个并发处理。"
          : "The job was queued. The persistent worker will process it with up to 5 concurrent jobs.",
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
    const matchedJobs = await loadSelectedJobs(db, ids)

    // Process sequentially to avoid partial failures in batch retries.
    // Each job update is independent but sequential processing ensures
    // predictable error handling and avoids transaction issues.
    for (const job of matchedJobs) {
      await queueJobForManualRun({ db, job })
    }

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

export async function pauseJobAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))

  return runSingleJobControlAction(formData, {
    fallbackMessage: lang === "zh" ? "暂停任务失败。" : "Failed to pause the job.",
    missingMessage: lang === "zh" ? "缺少任务 ID。" : "Missing job ID.",
    successMessage: lang === "zh" ? "已暂停任务。" : "The job was paused.",
    emptyMessage: lang === "zh" ? "该任务当前不可暂停。" : "This job cannot be paused.",
    operation: pauseJobForManualControl,
  })
}

export async function resumeJobAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))

  return runSingleJobControlAction(formData, {
    fallbackMessage: lang === "zh" ? "恢复任务失败。" : "Failed to resume the job.",
    missingMessage: lang === "zh" ? "缺少任务 ID。" : "Missing job ID.",
    successMessage: lang === "zh" ? "已恢复任务。" : "The job was resumed.",
    emptyMessage: lang === "zh" ? "该任务当前不可恢复。" : "This job cannot be resumed.",
    operation: resumeJobForManualControl,
  })
}

export async function cancelJobAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))

  return runSingleJobControlAction(formData, {
    fallbackMessage: lang === "zh" ? "取消任务失败。" : "Failed to cancel the job.",
    missingMessage: lang === "zh" ? "缺少任务 ID。" : "Missing job ID.",
    successMessage: lang === "zh" ? "已取消任务。" : "The job was cancelled.",
    emptyMessage: lang === "zh" ? "该任务当前不可取消。" : "This job cannot be cancelled.",
    operation: cancelJobForManualControl,
  })
}

export async function pauseSelectedJobsAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))

  return runSelectedJobControlAction(formData, {
    emptySelectionMessage: lang === "zh" ? "请先选择要暂停的任务。" : "Select jobs to pause first.",
    successMessage: (count) =>
      lang === "zh" ? `已暂停 ${count} 个任务。` : `${count} jobs paused.`,
    emptyRunnableMessage: lang === "zh" ? "选中的任务没有可暂停项。" : "The selected jobs cannot be paused.",
    operation: pauseJobForManualControl,
  })
}

export async function resumeSelectedJobsAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))

  return runSelectedJobControlAction(formData, {
    emptySelectionMessage: lang === "zh" ? "请先选择要恢复的任务。" : "Select jobs to resume first.",
    successMessage: (count) =>
      lang === "zh" ? `已恢复 ${count} 个任务。` : `${count} jobs resumed.`,
    emptyRunnableMessage: lang === "zh" ? "选中的任务没有可恢复项。" : "The selected jobs cannot be resumed.",
    operation: resumeJobForManualControl,
  })
}

export async function cancelSelectedJobsAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))

  return runSelectedJobControlAction(formData, {
    emptySelectionMessage: lang === "zh" ? "请先选择要取消的任务。" : "Select jobs to cancel first.",
    successMessage: (count) =>
      lang === "zh" ? `已取消 ${count} 个任务。` : `${count} jobs cancelled.`,
    emptyRunnableMessage: lang === "zh" ? "选中的任务没有可取消项。" : "The selected jobs cannot be cancelled.",
    operation: cancelJobForManualControl,
  })
}
