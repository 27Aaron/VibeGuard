import { and, desc, eq, sql } from "drizzle-orm"

import {
  articles,
  getDb,
  feeds,
  llmSettings,
  processingJobs,
} from "@vibeguard/db"
import { DEFAULT_TAG_PROMPT, resolveRelevancePrompt, resolveTagPrompt } from "@vibeguard/llm"
import { normalizeUserFacingError } from "./errors"
import {
  DEFAULT_ADMIN_ARTICLE_PAGE_SIZE,
  type AdminArticleListParams,
} from "./admin-article-pagination"
import {
  DEFAULT_ADMIN_JOB_PAGE_SIZE,
  type AdminJobStageFilter,
  type AdminJobListParams,
} from "./admin-job-pagination"
import type { AppLang } from "./i18n"
import { formatDateTimeInShanghai } from "./time"

export const DEFAULT_SUMMARY_PROMPT_EN =
  "Write a concise English summary that highlights the key security development, affected ecosystem, and why it matters."

export const DEFAULT_SUMMARY_PROMPT_ZH =
  "Write a concise Simplified Chinese summary that highlights the key security development, affected ecosystem, and why it matters."

export { DEFAULT_TAG_PROMPT }

const LEGACY_TRANSLATION_CONTENT_PROMPT =
  "Translate the article body into natural Chinese. Preserve links, package names, version strings, code snippets, and technical terms when needed."

export const DEFAULT_TRANSLATION_CONTENT_PROMPT =
  "Translate the article body into natural Chinese. Keep fenced code blocks, inline code, shell commands, configuration keys, package names, version strings, URLs, and file paths exactly unchanged. Translate the surrounding prose only."

export function normalizeLocalizedSummaryPrompt(input: {
  prompt: string | null | undefined
  fallback: string
}) {
  const normalized = String(input.prompt ?? "").trim()

  if (!normalized) {
    return input.fallback
  }

  return normalized
}

export function normalizeTranslationContentPrompt(input: string | null | undefined) {
  const normalized = String(input ?? "").trim()

  if (!normalized || normalized === LEGACY_TRANSLATION_CONTENT_PROMPT) {
    return DEFAULT_TRANSLATION_CONTENT_PROMPT
  }

  return normalized
}

export function normalizeTagPrompt(input: string | null | undefined) {
  return resolveTagPrompt(input)
}

export function normalizeRelevancePrompt(input: string | null | undefined) {
  return resolveRelevancePrompt(input)
}

export async function getFeedRows(lang: AppLang = "zh") {
  const db = getDb()
  const rows = await db
    .select()
    .from(feeds)
    .orderBy(desc(feeds.createdAt))

  return rows.map((feed) => ({
    id: feed.id,
    name: feed.name,
    siteUrl: feed.siteUrl,
    feedUrl: feed.feedUrl,
    feedType: feed.feedType,
    pollIntervalMinutes: feed.pollIntervalMinutes,
    enabled: feed.enabled,
    cadence:
      lang === "zh"
        ? `${feed.pollIntervalMinutes} 分钟`
        : `${feed.pollIntervalMinutes} minutes`,
    status: feed.enabled ? ("enabled" as const) : ("paused" as const),
    lastSyncedAt: feed.lastSuccessAt
      ? formatDateTimeInShanghai(feed.lastSuccessAt)
      : lang === "zh"
        ? "尚未同步"
        : "Not synced yet",
  }))
}

export async function getFeedDetail(feedId: string) {
  const db = getDb()

  return db.query.feeds.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, feedId),
  })
}

export async function getActiveLlmSettings() {
  const db = getDb()
  const row =
    (await db.query.llmSettings.findFirst({
      where: (table, { eq: whereEq }) => whereEq(table.isActive, true),
      orderBy: (table, { desc: orderDesc }) => [orderDesc(table.updatedAt)],
    })) ??
    (await db.query.llmSettings.findFirst({
      orderBy: (table, { desc: orderDesc }) => [orderDesc(table.updatedAt)],
    }))

  if (!row) {
    return buildDefaultLlmSettings()
  }

  return {
    id: row.id,
    providerName: "OpenAI",
    settingsName: row.name,
    baseUrl: row.baseUrl,
    hasStoredApiKey: true,
    model: row.model,
    isActive: row.isActive,
    translationTitlePrompt: row.translateTitlePrompt,
    translationContentPrompt: normalizeTranslationContentPrompt(
      row.translateContentPrompt,
    ),
    summaryPromptEn: normalizeLocalizedSummaryPrompt({
      prompt: row.summaryPromptEn,
      fallback: DEFAULT_SUMMARY_PROMPT_EN,
    }),
    summaryPromptZh: normalizeLocalizedSummaryPrompt({
      prompt: row.summaryPromptZh,
      fallback: DEFAULT_SUMMARY_PROMPT_ZH,
    }),
    tagPrompt: normalizeTagPrompt(row.tagPrompt),
    relevancePrompt: normalizeRelevancePrompt(row.relevancePrompt),
  }
}

function buildDefaultLlmSettings() {
  return {
    id: "",
    providerName: "OpenAI",
    settingsName: "default-openai",
    baseUrl: "https://api.openai.com/v1",
    hasStoredApiKey: false,
    model: "gpt-5-mini",
    isActive: true,
    translationTitlePrompt:
      "Translate the article title into concise Chinese while preserving names and product terms.",
    translationContentPrompt: DEFAULT_TRANSLATION_CONTENT_PROMPT,
    summaryPromptEn: DEFAULT_SUMMARY_PROMPT_EN,
    summaryPromptZh: DEFAULT_SUMMARY_PROMPT_ZH,
    tagPrompt: DEFAULT_TAG_PROMPT,
    relevancePrompt: normalizeRelevancePrompt(null),
  }
}

export async function getLlmSettingsRows() {
  const db = getDb()
  const rows = await db.query.llmSettings.findMany({
    orderBy: (table, { desc: orderDesc }) => [
      orderDesc(table.isActive),
      orderDesc(table.updatedAt),
    ],
  })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    model: row.model,
    isActive: row.isActive,
    hasStoredApiKey: Boolean(row.apiKeyEncrypted),
    updatedAt: formatDateTime(row.updatedAt),
  }))
}

export async function getLlmSettingsDetail(profileId?: string) {
  if (!profileId || profileId === "new") {
    return profileId === "new" ? buildDefaultLlmSettings() : getActiveLlmSettings()
  }

  const db = getDb()
  const row = await db.query.llmSettings.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, profileId),
  })

  if (!row) {
    return getActiveLlmSettings()
  }

  return {
    id: row.id,
    providerName: "OpenAI",
    settingsName: row.name,
    baseUrl: row.baseUrl,
    hasStoredApiKey: true,
    model: row.model,
    isActive: row.isActive,
    translationTitlePrompt: row.translateTitlePrompt,
    translationContentPrompt: normalizeTranslationContentPrompt(
      row.translateContentPrompt,
    ),
    summaryPromptEn: normalizeLocalizedSummaryPrompt({
      prompt: row.summaryPromptEn,
      fallback: DEFAULT_SUMMARY_PROMPT_EN,
    }),
    summaryPromptZh: normalizeLocalizedSummaryPrompt({
      prompt: row.summaryPromptZh,
      fallback: DEFAULT_SUMMARY_PROMPT_ZH,
    }),
    tagPrompt: normalizeTagPrompt(row.tagPrompt),
    relevancePrompt: normalizeRelevancePrompt(row.relevancePrompt),
  }
}

function formatDateTime(
  value: Date | null | undefined,
  lang: AppLang = "zh",
  fallback?: string,
) {
  return formatDateTimeInShanghai(value, { lang, fallback })
}

export async function getArticleRows(input: Partial<AdminArticleListParams> = {}) {
  const db = getDb()
  const pageSize = input.pageSize ?? DEFAULT_ADMIN_ARTICLE_PAGE_SIZE
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1))
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
  const totalCount = Number(countRow?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const offset = (page - 1) * pageSize
  const rows = await db
    .select({
      id: articles.id,
      titleEn: articles.titleEn,
      titleZh: articles.titleZh,
      sourceName: articles.sourceName,
      status: articles.status,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .orderBy(desc(articles.publishedAt))
    .limit(pageSize)
    .offset(offset)

  return {
    rows: rows.map((article) => ({
      id: article.id,
      title: article.titleZh || article.titleEn,
      titleEn: article.titleEn,
      titleZh: article.titleZh,
      source: article.sourceName,
      status: article.status,
      publishedAt: formatDateTime(article.publishedAt),
      updatedAt: formatDateTime(article.updatedAt),
    })),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      from: totalCount === 0 ? 0 : offset + 1,
      to: offset + rows.length,
    },
  }
}

export async function getArticleDetail(articleId: string) {
  const db = getDb()

  return db.query.articles.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, articleId),
  })
}

export async function getDashboardOverview(lang: AppLang = "zh") {
  const db = getDb()
  const [feedCountRow] = await db.select({ count: sql<number>`count(*)` }).from(feeds)
  const [articleCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
  const [queuedJobsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(processingJobs)
    .where(sql`${processingJobs.status} in ('queued', 'running')`)
  const activeSettings = await db.query.llmSettings.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.isActive, true),
  })

  return [
    {
      title: lang === "zh" ? "内容来源" : "Sources",
      value: String(feedCountRow?.count ?? 0),
      detail:
        lang === "zh"
          ? "已配置并可纳入采集的来源"
          : "Configured sources available for ingestion",
    },
    {
      title: lang === "zh" ? "文章入库" : "Stored articles",
      value: String(articleCountRow?.count ?? 0),
      detail:
        lang === "zh"
          ? "已经生成记录的文章总数"
          : "Article records currently stored",
    },
    {
      title: lang === "zh" ? "待处理任务" : "Active jobs",
      value: String(queuedJobsRow?.count ?? 0),
      detail:
        lang === "zh"
          ? "排队中或执行中的处理任务"
          : "Queued or currently running jobs",
    },
    {
      title: lang === "zh" ? "当前模型" : "Active model",
      value:
        activeSettings?.model ??
        (lang === "zh" ? "未配置生效模型" : "No active model configured"),
      detail: activeSettings
        ? lang === "zh"
          ? "Worker 当前使用的模型配置"
          : "Model profile currently used by the worker"
        : lang === "zh"
          ? "请先配置模型服务访问参数"
          : "Configure model service access before processing articles",
    },
  ] as const
}

export async function getJobPreviewRows() {
  const db = getDb()
  const rows = await db
    .select({
      id: processingJobs.id,
      jobType: processingJobs.jobType,
      status: processingJobs.status,
      runAfter: processingJobs.runAfter,
      articleTitle: articles.titleZh,
      fallbackTitle: articles.titleEn,
    })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .orderBy(desc(processingJobs.createdAt))
    .limit(5)

  return rows.map((row) => ({
    id: row.id,
    articleTitle: row.articleTitle || row.fallbackTitle,
    jobType: row.jobType,
    status: row.status,
    runAt: formatDateTime(row.runAfter),
  }))
}

export async function getJobStatusCounts(lang: AppLang = "zh") {
  const db = getDb()
  const counts = await db
    .select({
      status: processingJobs.status,
      count: sql<number>`count(*)`,
    })
    .from(processingJobs)
    .groupBy(processingJobs.status)

  const countMap = new Map(counts.map((row) => [row.status, Number(row.count)]))

  // 统计被过滤的文章关联的任务数
  const [filteredCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .where(eq(articles.status, "filtered"))
  const filteredCount = Number(filteredCountRow?.count ?? 0)

  return [
    {
      status: "all",
      label: lang === "zh" ? "全部内容" : "All content",
      count: [...countMap.values()].reduce((sum, count) => sum + count, 0),
    },
    { status: "running", label: lang === "zh" ? "执行中" : "Running", count: countMap.get("running") ?? 0 },
    { status: "failed", label: lang === "zh" ? "失败" : "Failed", count: countMap.get("failed") ?? 0 },
    { status: "filtered", label: lang === "zh" ? "已过滤" : "Filtered", count: filteredCount },
    { status: "succeeded", label: lang === "zh" ? "已完成" : "Succeeded", count: countMap.get("succeeded") ?? 0 },
  ] as const
}

type JobStatusInput = "all" | "running" | "succeeded" | "failed" | "filtered"

export async function getJobRows(input: Partial<AdminJobListParams> & {
  status?: JobStatusInput
  lang?: AppLang
} = {}) {
  const db = getDb()
  const status = input.status ?? "all"
  const stage = input.stage ?? "all"
  const lang = input.lang ?? "zh"
  const pageSize = input.pageSize ?? DEFAULT_ADMIN_JOB_PAGE_SIZE
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1))
  const filters = [
    status === "all" ? undefined
      : status === "filtered" ? eq(articles.status, "filtered")
      : eq(processingJobs.status, status),
    stage === "all"
      ? undefined
      : eq(processingJobs.pipelineStage, stage as Exclude<AdminJobStageFilter, "all">),
  ].filter(Boolean)
  const useJoin = status === "filtered"
  const baseQuery = useJoin
    ? db.select({ count: sql<number>`count(*)` }).from(processingJobs).innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    : db.select({ count: sql<number>`count(*)` }).from(processingJobs)
  const where = filters.length > 0 ? and(...filters) : undefined
  const [countRow] = await baseQuery.where(where)
  const totalCount = Number(countRow?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const offset = (page - 1) * pageSize
  const rows = await db
    .select({
      id: processingJobs.id,
      articleId: articles.id,
      articleTitleZh: articles.titleZh,
      articleTitleEn: articles.titleEn,
      sourceName: articles.sourceName,
      jobType: processingJobs.jobType,
      status: processingJobs.status,
      pipelineStage: processingJobs.pipelineStage,
      attempt: processingJobs.attempt,
      maxAttempts: processingJobs.maxAttempts,
      runAfter: processingJobs.runAfter,
      startedAt: processingJobs.startedAt,
      finishedAt: processingJobs.finishedAt,
      updatedAt: processingJobs.updatedAt,
      lastError: processingJobs.lastError,
    })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .where(where)
    .orderBy(desc(processingJobs.updatedAt))
    .limit(pageSize)
    .offset(offset)

  return {
    rows: rows.map((row) => ({
      id: row.id,
      articleId: row.articleId,
      articleTitle: row.articleTitleZh || row.articleTitleEn,
      sourceName: row.sourceName,
      jobType: row.jobType,
      status: row.status,
      pipelineStage: row.pipelineStage,
      attempt: row.attempt,
      maxAttempts: row.maxAttempts,
      runAt: formatDateTime(row.runAfter, lang),
      startedAt: formatDateTime(
        row.startedAt,
        lang,
        lang === "zh" ? "尚未开始" : "Not started",
      ),
      finishedAt: formatDateTime(
        row.finishedAt,
        lang,
        lang === "zh" ? "尚未结束" : "Not finished",
      ),
      updatedAt: formatDateTime(row.updatedAt, lang),
      lastError: row.lastError
        ? normalizeUserFacingError(new Error(row.lastError), lang)
        : null,
    })),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      from: totalCount === 0 ? 0 : offset + 1,
      to: offset + rows.length,
    },
  }
}
