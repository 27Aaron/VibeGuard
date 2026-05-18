"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { and, eq, inArray, sql } from "drizzle-orm"

import { articles, getDb, processingJobs } from "@vibeguard/db"
import {
  ArticleStatus,
  JobPipelineStage,
  JobStatus,
  JobType,
} from "@vibeguard/shared"

import {
  ARTICLE_REGENERATION_TARGETS,
  getRegenerationRequirementError,
  regenerateArticleTarget,
  type ArticleRegenerationTarget,
} from "../article-regeneration"
import { normalizeUserFacingError } from "../errors"
import { resolveLang } from "../i18n"

function buildArticleDetailRedirect(
  articleId: string,
  message: string,
  status: "success" | "error",
  lang: "zh" | "en",
) {
  const params = new URLSearchParams({
    status,
    message,
    lang,
  })

  return `/admin/articles/${articleId}?${params.toString()}`
}

export async function reprocessArticleAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const articleId = String(formData.get("id") ?? "").trim()
  const target = resolveRegenerationTarget(formData.get("target"))

  if (!articleId) {
    redirect(`/admin/articles?lang=${lang}`)
  }

  let redirectMessage = ""
  let redirectStatus: "success" | "error" = "success"

  try {
    const db = getDb()
    const article = await db.query.articles.findFirst({
      where: eq(articles.id, articleId),
    })

    if (!article) {
      redirectMessage = lang === "zh" ? "未找到对应文章。" : "Article not found."
      redirectStatus = "error"
    } else {
      const activeJob = await db.query.processingJobs.findFirst({
        where: and(
          eq(processingJobs.articleId, articleId),
          inArray(processingJobs.status, [JobStatus.QUEUED, JobStatus.RUNNING]),
        ),
      })

      if (activeJob) {
        redirectMessage =
          lang === "zh"
            ? "当前文章已经在排队或处理中。"
            : "This article is already queued or processing."
        redirectStatus = "error"
      } else if (target === "full") {
        const existingJob = await db.query.processingJobs.findFirst({
          where: and(
            eq(processingJobs.articleId, articleId),
            eq(processingJobs.jobType, JobType.EXTRACT),
          ),
        })

        if (existingJob) {
          await db
            .update(processingJobs)
            .set({
              status: JobStatus.QUEUED,
              pipelineStage: JobPipelineStage.WAITING,
              attempt: 0,
              maxAttempts: 3,
              runAfter: new Date(),
              startedAt: null,
              finishedAt: null,
              lastError: null,
            })
            .where(eq(processingJobs.id, existingJob.id))
        } else {
          await db.insert(processingJobs).values({
            articleId,
            jobType: JobType.EXTRACT,
            status: JobStatus.QUEUED,
            pipelineStage: JobPipelineStage.WAITING,
            attempt: 0,
            maxAttempts: 3,
            runAfter: new Date(),
          })
        }

        await db
          .update(articles)
          .set({
            status: ArticleStatus.PENDING,
            titleZh: null,
            summaryEn: null,
            summaryZh: null,
            contentMdEn: null,
            contentMdZh: null,
            ecosystem: "unknown",
            riskCategory: "unknown",
            tags: [],
            contentHash: null,
            rawMeta: sql`CASE
              WHEN ${articles.rawMeta} IS NULL THEN NULL
              ELSE ${articles.rawMeta} - 'processingError'
            END`,
          })
          .where(eq(articles.id, articleId))

        redirectMessage = buildSuccessMessage(target, lang)
        redirectStatus = "success"
      } else {
        const requirementError = getRegenerationRequirementError(article, target, lang)

        if (requirementError) {
          redirectMessage = requirementError
          redirectStatus = "error"
        } else {
          const activeSettings = await db.query.llmSettings.findFirst({
            where: (table, { eq: whereEq }) => whereEq(table.isActive, true),
          })

          if (!activeSettings) {
            throw new Error("No active LLM settings found for article processing.")
          }

          const result = await regenerateArticleTarget({
            article,
            settings: activeSettings,
            target,
          })

          const nextRawMeta =
            article.rawMeta && typeof article.rawMeta === "object"
              ? { ...(article.rawMeta as Record<string, unknown>) }
              : null

          if (nextRawMeta && "processingError" in nextRawMeta) {
            delete nextRawMeta.processingError
          }

          await db
            .update(articles)
            .set({
              ...result.patch,
              status: result.nextStatus,
              rawMeta: nextRawMeta,
            })
            .where(eq(articles.id, articleId))

          redirectMessage = buildSuccessMessage(target, lang)
          redirectStatus = "success"
        }
      }

      if (redirectStatus === "success") {
        revalidatePath("/admin")
        revalidatePath("/admin/articles")
        revalidatePath("/admin/jobs")
        revalidatePath(`/admin/articles/${articleId}`)
        revalidatePath(`/articles/${articleId}`)
        revalidatePath("/")
      }
    }
  } catch (error) {
    redirectMessage = normalizeUserFacingError(error, lang)
    redirectStatus = "error"
  }

  redirect(
    buildArticleDetailRedirect(articleId, redirectMessage, redirectStatus, lang),
  )
}

function resolveRegenerationTarget(value: FormDataEntryValue | null): ArticleRegenerationTarget {
  const normalized = String(value ?? "full").trim()

  return ARTICLE_REGENERATION_TARGETS.includes(
    normalized as ArticleRegenerationTarget,
  )
    ? (normalized as ArticleRegenerationTarget)
    : "full"
}

function buildSuccessMessage(target: ArticleRegenerationTarget, lang: "zh" | "en") {
  if (lang === "zh") {
    switch (target) {
      case "title-zh":
        return "已重新生成中文标题。"
      case "content-zh":
        return "已重新生成中文正文。"
      case "summary-en":
        return "已重新生成英文摘要。"
      case "summary-zh":
        return "已重新生成中文摘要。"
      case "tags":
        return "已重新生成标签。"
      case "full":
      default:
        return "已将文章重新加入全量处理队列。"
    }
  }

  switch (target) {
    case "title-zh":
      return "The Chinese title has been regenerated."
    case "content-zh":
      return "The Chinese body has been regenerated."
    case "summary-en":
      return "The English summary has been regenerated."
    case "summary-zh":
      return "The Chinese summary has been regenerated."
    case "tags":
      return "Tags have been regenerated."
    case "full":
    default:
      return "The article has been queued for full reprocessing."
  }
}
