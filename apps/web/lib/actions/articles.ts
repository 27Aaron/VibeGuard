"use server"

import { redirect } from "next/navigation"

import { and, eq, inArray } from "drizzle-orm"

import { articles, getDb, processingJobs } from "@vibeguard/db"
import {
  JobStatus,
} from "@vibeguard/shared"

import {
  ARTICLE_REGENERATION_TARGETS,
  getRegenerationRequirementError,
  regenerateArticleTarget,
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- extract-content 分支不使用 settings
            settings: activeSettings as any,
            target,
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

          await db
            .update(articles)
            .set({
              ...patchWithoutRawMeta,
              rawMeta: mergedRawMeta,
              status: result.nextStatus,
            })
            .where(eq(articles.id, articleId))

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
