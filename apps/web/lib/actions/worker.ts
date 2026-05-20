"use server"

import { redirect } from "next/navigation"
import { inArray } from "drizzle-orm"

import { articles, getDb } from "@vibeguard/db"
import { runWorkerCycle } from "worker"

import {
  buildWorkerRunErrorParams,
  buildWorkerRunRedirectParams,
} from "../worker-run"
import { resolveLang } from "../i18n"

async function loadProcessedJobDetails(
  processedJobs: Awaited<ReturnType<typeof runWorkerCycle>>["processedJobs"],
) {
  if (processedJobs.length === 0) {
    return []
  }

  const db = getDb()
  const articleIds = [...new Set(processedJobs.map((job) => job.articleId))]
  const articleRows = await db
    .select({
      id: articles.id,
      titleZh: articles.titleZh,
      titleEn: articles.titleEn,
    })
    .from(articles)
    .where(inArray(articles.id, articleIds))
  const articleTitleMap = new Map(
    articleRows.map((row) => [row.id, row.titleZh || row.titleEn]),
  )

  return processedJobs.slice(0, 5).map((job) => ({
    articleId: job.articleId,
    title: articleTitleMap.get(job.articleId) ?? job.articleId,
    status: job.status,
    error: "error" in job ? job.error : undefined,
  }))
}

export async function runWorkerOnceAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  let redirectTarget = `/${lang}/admin`

  try {
    const summary = await runWorkerCycle()
    const details = await loadProcessedJobDetails(summary.processedJobs)
    const params = buildWorkerRunRedirectParams(summary, details)

    redirectTarget = `/${lang}/admin?${params.toString()}`
  } catch (error) {
    const params = buildWorkerRunErrorParams(error)
    redirectTarget = `/${lang}/admin?${params.toString()}`
  }

  redirect(redirectTarget)
}
