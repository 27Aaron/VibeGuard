"use server"

import { redirect } from "next/navigation"

import { and, eq, inArray, sql } from "drizzle-orm"

import { articles, getDb, processingJobs, schema } from "@vibeguard/db"
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
  defaultDependencies,
  type ArticleRegenerationTarget,
} from "../article-regeneration"
import { normalizeUserFacingError } from "../errors"
import { resolveLang } from "../i18n"
import { revalidateLocalizedPaths } from "../revalidate"

function buildArticleDetailRedirect(
  articleId: string,
  message: string,
  status: "success" | "error",
  lang: "zh" | "en",
) {
  const params = new URLSearchParams({
    status,
    message,
  })

  return `/${lang}/admin/articles/${articleId}?${params.toString()}`
}

type ArticlesListRedirectContext = {
  page?: string
  pageSize?: string
  q?: string
}

type SelectedArticlesActionIntent = "delete" | "regenerate"

function buildArticlesListRedirect(
  status: "success" | "error",
  message: string,
  lang: "zh" | "en",
  context: ArticlesListRedirectContext = {},
) {
  const params = new URLSearchParams({
    status,
    message,
  })

  if (context.page) {
    params.set("page", context.page)
  }

  if (context.pageSize) {
    params.set("pageSize", context.pageSize)
  }

  if (context.q?.trim()) {
    params.set("q", context.q.trim())
  }

  return `/${lang}/admin/articles?${params.toString()}`
}

function getArticlesListRedirectContext(formData: FormData): ArticlesListRedirectContext {
  return {
    page: String(formData.get("page") ?? "1"),
    pageSize: String(formData.get("pageSize") ?? "10"),
    q: String(formData.get("q") ?? ""),
  }
}

function getSelectedArticleIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("ids")
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  )
}

function getSelectedArticlesIntent(formData: FormData): SelectedArticlesActionIntent {
  return String(formData.get("intent") ?? "delete") === "regenerate"
    ? "regenerate"
    : "delete"
}

export async function selectedArticlesAction(formData: FormData) {
  const intent = getSelectedArticlesIntent(formData)

  if (intent === "regenerate") {
    await regenerateSelectedArticlesAction(formData)
    return
  }

  await deleteSelectedArticlesAction(formData)
}

export async function deleteSelectedArticlesAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const redirectContext = getArticlesListRedirectContext(formData)
  const ids = getSelectedArticleIds(formData)

  let redirectTarget = buildArticlesListRedirect(
    "error",
    lang === "zh"
      ? "请先选择要删除的文章。"
      : "Select articles to delete first.",
    lang,
    redirectContext,
  )

  if (ids.length === 0) {
    redirect(redirectTarget)
  }

  try {
    const db = getDb()
    const existingRows = await db.query.articles.findMany({
      where: inArray(articles.id, ids),
      columns: { id: true },
    })
    const existingIds = existingRows.map((article) => article.id)

    if (existingIds.length === 0) {
      redirectTarget = buildArticlesListRedirect(
        "error",
        lang === "zh"
          ? "选中的文章不存在或已经被删除。"
          : "The selected articles were not found or were already deleted.",
        lang,
        redirectContext,
      )
    } else {
      await db.delete(articles).where(inArray(articles.id, existingIds))

      revalidateLocalizedPaths(
        "/admin",
        "/admin/articles",
        "/admin/jobs",
        "/",
        ...existingIds.flatMap((articleId) => [
          `/admin/articles/${articleId}`,
          `/articles/${articleId}`,
        ]),
      )

      redirectTarget = buildArticlesListRedirect(
        "success",
        lang === "zh"
          ? `已删除 ${existingIds.length} 篇文章。`
          : `${existingIds.length} article${existingIds.length === 1 ? "" : "s"} deleted.`,
        lang,
        redirectContext,
      )
    }
  } catch (error) {
    redirectTarget = buildArticlesListRedirect(
      "error",
      normalizeUserFacingError(error, lang),
      lang,
      redirectContext,
    )
  }

  redirect(redirectTarget)
}

export async function regenerateSelectedArticlesAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const redirectContext = getArticlesListRedirectContext(formData)
  const ids = getSelectedArticleIds(formData)

  let redirectTarget = buildArticlesListRedirect(
    "error",
    lang === "zh"
      ? "请先选择要重试的文章。"
      : "Select articles to regenerate first.",
    lang,
    redirectContext,
  )

  if (ids.length === 0) {
    redirect(redirectTarget)
  }

  try {
    const db = getDb()
    const now = new Date()
    const queuedArticleIds = await db.transaction(async (tx) => {
      const existingRows = await tx.query.articles.findMany({
        where: inArray(articles.id, ids),
        columns: { id: true },
      })
      const existingIds = existingRows.map((article) => article.id)

      if (existingIds.length === 0) {
        return [] as string[]
      }

      const activeJobs = await tx.query.processingJobs.findMany({
        where: and(
          inArray(processingJobs.articleId, existingIds),
          inArray(processingJobs.status, [JobStatus.QUEUED, JobStatus.RUNNING]),
        ),
        columns: { articleId: true },
      })
      const activeArticleIds = new Set(activeJobs.map((job) => job.articleId))
      const candidateIds = existingIds.filter((id) => !activeArticleIds.has(id))

      if (candidateIds.length === 0) {
        return [] as string[]
      }

      const existingExtractJobs = await tx.query.processingJobs.findMany({
        where: and(
          inArray(processingJobs.articleId, candidateIds),
          eq(processingJobs.jobType, JobType.EXTRACT),
        ),
        columns: { id: true, articleId: true },
      })
      const existingExtractArticleIds = new Set(
        existingExtractJobs.map((job) => job.articleId),
      )
      const requeuedJobIds = existingExtractJobs.map((job) => job.id)

      if (requeuedJobIds.length > 0) {
        await tx
          .update(processingJobs)
          .set({
            status: JobStatus.QUEUED,
            pipelineStage: JobPipelineStage.WAITING,
            maxAttempts: sql`${processingJobs.maxAttempts} + 3`,
            runAfter: now,
            startedAt: null,
            finishedAt: null,
            lastError: null,
          })
          .where(inArray(processingJobs.id, requeuedJobIds))
      }

      const withoutExistingJobIds = candidateIds.filter(
        (articleId) => !existingExtractArticleIds.has(articleId),
      )
      const insertedJobs = withoutExistingJobIds.length > 0
        ? await tx
          .insert(processingJobs)
          .values(
            withoutExistingJobIds.map((articleId) => ({
              articleId,
              jobType: JobType.EXTRACT,
              status: JobStatus.QUEUED,
              pipelineStage: JobPipelineStage.WAITING,
              attempt: 0,
              maxAttempts: 3,
              runAfter: now,
            })),
          )
          .onConflictDoNothing()
          .returning({ articleId: processingJobs.articleId })
        : []

      const queuedArticleIds = [
        ...existingExtractJobs.map((job) => job.articleId),
        ...insertedJobs.map((job) => job.articleId),
      ]

      if (queuedArticleIds.length > 0) {
        await tx
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
              ELSE ${articles.rawMeta} - 'processingError' - 'extraction' - 'relevanceFilter'
            END`,
          })
          .where(inArray(articles.id, queuedArticleIds))
      }

      return queuedArticleIds
    })

    revalidateLocalizedPaths(
      "/admin",
      "/admin/articles",
      "/admin/jobs",
      "/",
      ...queuedArticleIds.flatMap((articleId) => [
        `/admin/articles/${articleId}`,
        `/articles/${articleId}`,
      ]),
    )

    redirectTarget = buildArticlesListRedirect(
      queuedArticleIds.length > 0 ? "success" : "error",
      queuedArticleIds.length > 0
        ? lang === "zh"
          ? `已将 ${queuedArticleIds.length} 篇文章加入重试队列。`
          : `${queuedArticleIds.length} article${queuedArticleIds.length === 1 ? "" : "s"} queued for regeneration.`
        : lang === "zh"
          ? "选中的文章不存在，或已经在排队/处理中。"
          : "The selected articles were not found or are already queued/processing.",
      lang,
      redirectContext,
    )
  } catch (error) {
    redirectTarget = buildArticlesListRedirect(
      "error",
      normalizeUserFacingError(error, lang),
      lang,
      redirectContext,
    )
  }

  redirect(redirectTarget)
}

export async function reprocessArticleAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const articleId = String(formData.get("id") ?? "").trim()
  const target = resolveRegenerationTarget(formData.get("target"))

  if (!articleId) {
    redirect(`/${lang}/admin/articles`)
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
      } else {
        const requirementError = getRegenerationRequirementError(article, target, lang)

        if (requirementError) {
          redirectMessage = requirementError
          redirectStatus = "error"
        } else {
          const needsLlm = target !== "extract-content"
          const activeSettings = needsLlm
            ? await db.query.llmSettings.findFirst({
                where: (table, { eq: whereEq }) => whereEq(table.isActive, true),
              })
            : null

          if (!activeSettings && needsLlm) {
            throw new Error("No active LLM settings found for article processing.")
          }

          const result = await regenerateArticleTarget({
            article,
            settings: activeSettings!,
            target,
          }, {
            ...defaultDependencies,
            logLlmUsage: async (input) => {
              if (!input.usage) return
              await db.insert(schema.llmUsageLogs).values({
                articleId: input.articleId,
                jobId: null,
                taskType: input.taskType,
                model: input.model,
                promptTokens: input.usage.promptTokens,
                completionTokens: input.usage.completionTokens,
                totalTokens: input.usage.totalTokens,
                cachedTokens: input.usage.cachedTokens ?? null,
                finishReason: input.usage.finishReason ?? null,
                responseTimeMs: input.responseTimeMs,
              })
            },
          })

          const baseRawMeta =
            article.rawMeta && typeof article.rawMeta === "object"
              ? { ...(article.rawMeta as Record<string, unknown>) }
              : {}
          if ("processingError" in baseRawMeta) {
            delete baseRawMeta.processingError
          }

          const patchRawMeta = result.patch.rawMeta as Record<string, unknown> | undefined
          const mergedRawMeta = patchRawMeta
            ? { ...baseRawMeta, ...patchRawMeta }
            : baseRawMeta

          const { rawMeta: _, ...patchWithoutRawMeta } = result.patch

          // 在 UPDATE 中使用状态守卫来关闭 TOCTOU（Time-of-check to time-of-use）竞态窗口：
          // 仅当文章状态未被并发请求修改时才应用变更，防止覆盖其他请求的结果。
          await db.transaction(async (tx) => {
            const current = await tx.query.articles.findFirst({
              where: eq(articles.id, articleId),
              columns: { status: true },
            })

            if (current && current.status === article.status) {
              await tx
                .update(articles)
                .set({
                  ...patchWithoutRawMeta,
                  rawMeta: mergedRawMeta,
                  status: result.nextStatus,
                })
                .where(eq(articles.id, articleId))
            }
          })

          redirectMessage = buildSuccessMessage(target, lang)
          redirectStatus = "success"
        }
      }

      if (redirectStatus === "success") {
        revalidateLocalizedPaths(
          "/admin",
          "/admin/articles",
          "/admin/jobs",
          `/admin/articles/${articleId}`,
          `/articles/${articleId}`,
          "/",
        )
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
    : "fetch-source"
}

function buildSuccessMessage(target: ArticleRegenerationTarget, lang: "zh" | "en") {
  if (lang === "zh") {
    switch (target) {
      case "fetch-source":
        return "已重新抓取原文。"
      case "extract-content":
        return "已重新提取正文。"
      case "classify-relevance":
        return "已重新判断相关性。"
      case "skip-relevance":
        return "已跳过相关性判断。"
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
    }
  }

  switch (target) {
    case "fetch-source":
      return "Source has been re-fetched."
    case "extract-content":
      return "Content has been re-extracted."
    case "classify-relevance":
      return "Relevance has been re-classified."
    case "skip-relevance":
      return "Relevance has been skipped."
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
  }
}
