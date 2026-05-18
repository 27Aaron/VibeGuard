import { createHash } from "node:crypto"

import { and, eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { fetchArticleHtml } from "@vibeguard/content/extract/article-html"
import {
  classifySecurityContent,
  extractMarkdownFromHtml,
  type ExtractedArticle,
} from "@vibeguard/content"
import { articles, llmSettings, schema } from "@vibeguard/db"
import {
  createOpenAIClient,
  decryptSecret,
  generateTags,
  DEFAULT_TAG_PROMPT,
  resolveTagPrompt,
  summarizeText,
  translateText,
} from "@vibeguard/llm"
import { ArticleStatus, JobPipelineStage, JobType } from "@vibeguard/shared"

import {
  claimQueuedJobById,
  claimNextQueuedJob,
  markJobFailed,
  markJobStage,
  markJobSucceeded,
  resetStaleRunningJobs,
} from "./jobs"

type ContentDb = NodePgDatabase<typeof schema>

type ArticleRecord = typeof articles.$inferSelect
type LlmSettingsRecord = typeof llmSettings.$inferSelect
type JobRecord = typeof schema.processingJobs.$inferSelect
type ArticlePatch = Partial<
  Pick<
    ArticleRecord,
    | "titleEn"
    | "titleZh"
    | "summaryEn"
    | "summaryZh"
    | "contentMdEn"
    | "contentMdZh"
    | "ecosystem"
    | "riskCategory"
    | "tags"
    | "contentHash"
    | "status"
    | "rawMeta"
  >
>

export function buildSummaryPrompt(basePrompt: string, locale: "en" | "zh") {
  if (locale === "zh") {
    return `${basePrompt}\nThe summary itself must be written in Simplified Chinese. If any earlier or conflicting instruction specifies another language, ignore it and respond in Simplified Chinese only.`
  }

  return `${basePrompt}\nThe summary itself must be written in English. If any earlier or conflicting instruction specifies another language, ignore it and respond in English only.`
}

export type ProcessArticleJobDependencies = {
  loadArticle: (articleId: string) => Promise<ArticleRecord | undefined>
  loadActiveLlmSettings: () => Promise<LlmSettingsRecord | undefined>
  markArticleStatus: (
    articleId: string,
    status: typeof ArticleStatus[keyof typeof ArticleStatus],
    error?: string,
  ) => Promise<void>
  updateArticleContent: (
    articleId: string,
    content: {
      titleEn: string
      titleZh: string
      summaryEn: string
      summaryZh: string
      contentMdEn: string
      contentMdZh: string
      ecosystem: string
      riskCategory: string
      tags: string[]
      contentHash: string
      rawMeta: Record<string, unknown>
    },
  ) => Promise<void>
  updateArticlePatch?: (articleId: string, patch: ArticlePatch) => Promise<void>
  fetchArticleHtml: typeof fetchArticleHtml
  extractMarkdownFromHtml: (
    html: string,
    url: string,
  ) => Promise<ExtractedArticle>
  createOpenAIClient: typeof createOpenAIClient
  decryptSecret: typeof decryptSecret
  translateText: typeof translateText
  summarizeText: typeof summarizeText
  generateTags?: typeof generateTags
  markJobStage?: (
    stage: typeof JobPipelineStage[keyof typeof JobPipelineStage],
  ) => Promise<void>
}

function resolveLocalizedSummaryPrompt(
  settings: Pick<LlmSettingsRecord, "summaryPromptEn" | "summaryPromptZh">,
  locale: "en" | "zh",
) {
  if (locale === "zh") {
    return settings.summaryPromptZh
  }

  return settings.summaryPromptEn
}

export async function processArticleJob(
  job: Pick<JobRecord, "articleId"> & Partial<Pick<JobRecord, "jobType">>,
  dependencies: ProcessArticleJobDependencies,
) {
  const article = await dependencies.loadArticle(job.articleId)

  if (!article) {
    throw new Error(`Article not found for job: ${job.articleId}`)
  }

  const activeSettings = await dependencies.loadActiveLlmSettings()

  if (!activeSettings) {
    throw new Error("No active LLM settings found for article processing.")
  }

  const apiKey = dependencies.decryptSecret(activeSettings.apiKeyEncrypted)

  if (!apiKey) {
    throw new Error("Active LLM settings could not be decrypted.")
  }

  await dependencies.markArticleStatus(article.id, ArticleStatus.PROCESSING)
  const client = dependencies.createOpenAIClient({
    baseUrl: activeSettings.baseUrl,
    apiKey,
  })
  const jobType = job.jobType ?? JobType.EXTRACT

  if (jobType === JobType.SUMMARIZE) {
    await processSummarizeJob({
      article,
      activeSettings,
      client,
      dependencies,
    })
    await dependencies.markArticleStatus(article.id, ArticleStatus.READY)
    return
  }

  if (jobType === JobType.TRANSLATE) {
    await processTranslateJob({
      article,
      activeSettings,
      client,
      dependencies,
    })
    await dependencies.markArticleStatus(article.id, ArticleStatus.READY)
    return
  }

  await processExtractJob({
    article,
    activeSettings,
    client,
    dependencies,
  })
  await dependencies.markArticleStatus(article.id, ArticleStatus.READY)
}

async function processExtractJob(input: {
  article: ArticleRecord
  activeSettings: LlmSettingsRecord
  client: Parameters<typeof translateText>[0]["client"]
  dependencies: ProcessArticleJobDependencies
}) {
  const rawMeta = toRawMetaRecord(input.article.rawMeta)
  let titleEn = input.article.titleEn
  let contentMdEn = input.article.contentMdEn
  let titleZh = input.article.titleZh
  let contentMdZh = input.article.contentMdZh
  let summaryEn = input.article.summaryEn
  let summaryZh = input.article.summaryZh

  if (!hasText(titleEn) || !hasText(contentMdEn)) {
    await input.dependencies.markJobStage?.(JobPipelineStage.FETCH_SOURCE)
    const html = await input.dependencies.fetchArticleHtml(input.article.url)
    await input.dependencies.markJobStage?.(JobPipelineStage.EXTRACT_CONTENT)
    const extracted = await input.dependencies.extractMarkdownFromHtml(
      html,
      input.article.url,
    )

    titleEn = extracted.title
    contentMdEn = extracted.contentMd
    rawMeta.extraction = {
      author: extracted.author,
      description: extracted.description,
      publishedAt: extracted.publishedAt,
      siteName: extracted.siteName,
    }

    await persistArticlePatch(input.dependencies, input.article, {
      titleEn,
      contentMdEn,
      contentHash: buildContentHash(titleEn, contentMdEn),
      rawMeta,
    })
  }

  const requiredTitleEn = requireArticleField(titleEn, "English title")
  const requiredContentMdEn = requireArticleField(contentMdEn, "English body")

  if (!hasText(titleZh)) {
    await input.dependencies.markJobStage?.(JobPipelineStage.TRANSLATE_TITLE)
    titleZh = await input.dependencies.translateText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: input.activeSettings.translateTitlePrompt,
      sourceText: requiredTitleEn,
    })
    await persistArticlePatch(input.dependencies, input.article, { titleZh })
  }

  if (!hasText(contentMdZh)) {
    await input.dependencies.markJobStage?.(JobPipelineStage.TRANSLATE_CONTENT)
    contentMdZh = await input.dependencies.translateText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: input.activeSettings.translateContentPrompt,
      sourceText: requiredContentMdEn,
    })
    await persistArticlePatch(input.dependencies, input.article, { contentMdZh })
  }

  if (!hasText(summaryEn)) {
    await input.dependencies.markJobStage?.(JobPipelineStage.SUMMARIZE_EN)
    summaryEn = await input.dependencies.summarizeText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: buildSummaryPrompt(
        resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
        "en",
      ),
      sourceText: requiredContentMdEn,
    })
    await persistArticlePatch(input.dependencies, input.article, { summaryEn })
  }

  const requiredContentMdZh = requireArticleField(contentMdZh, "Chinese body")

  if (!hasText(summaryZh)) {
    await input.dependencies.markJobStage?.(JobPipelineStage.SUMMARIZE_ZH)
    summaryZh = await input.dependencies.summarizeText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: buildSummaryPrompt(
        resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
        "zh",
      ),
      sourceText: requiredContentMdZh,
    })
    await persistArticlePatch(input.dependencies, input.article, { summaryZh })
  }

  const requiredSummaryEn = requireArticleField(summaryEn, "English summary")
  const classification = classifySecurityContent({
    sourceName: input.article.sourceName,
    url: input.article.url,
    title: requiredTitleEn,
    summary: rawMeta.extraction && typeof rawMeta.extraction === "object"
      ? String(
          (rawMeta.extraction as { description?: unknown }).description ??
            requiredSummaryEn,
        )
      : requiredSummaryEn,
    content: requiredContentMdEn,
    categories: Array.isArray(rawMeta.categories)
      ? (rawMeta.categories as string[])
      : undefined,
  })
  await input.dependencies.markJobStage?.(JobPipelineStage.GENERATE_TAGS)
  const tags = await generateArticleTags({
    dependencies: input.dependencies,
    client: input.client,
    model: input.activeSettings.model,
    systemPrompt: resolveTagPrompt(input.activeSettings.tagPrompt || DEFAULT_TAG_PROMPT),
    sourceText: requiredContentMdEn,
  })

  await input.dependencies.updateArticleContent(input.article.id, {
    titleEn: requiredTitleEn,
    titleZh: requireArticleField(titleZh, "Chinese title"),
    summaryEn: requiredSummaryEn,
    summaryZh: requireArticleField(summaryZh, "Chinese summary"),
    contentMdEn: requiredContentMdEn,
    contentMdZh: requiredContentMdZh,
    ecosystem: classification.ecosystem,
    riskCategory: classification.riskCategory,
    tags,
    contentHash: buildContentHash(requiredTitleEn, requiredContentMdEn),
    rawMeta,
  })
}

async function generateArticleTags(input: {
  dependencies: ProcessArticleJobDependencies
  client: Parameters<typeof generateTags>[0]["client"]
  model: string
  systemPrompt: string
  sourceText: string
}) {
  try {
    const tagGenerator = input.dependencies.generateTags ?? generateTags

    return await tagGenerator({
      client: input.client,
      model: input.model,
      systemPrompt: input.systemPrompt,
      sourceText: input.sourceText,
    })
  } catch {
    return []
  }
}

async function processSummarizeJob(input: {
  article: ArticleRecord
  activeSettings: LlmSettingsRecord
  client: Parameters<typeof summarizeText>[0]["client"]
  dependencies: ProcessArticleJobDependencies
}) {
  const contentMdEn = requireArticleField(input.article.contentMdEn, "English body")
  const contentMdZh = requireArticleField(input.article.contentMdZh, "Chinese body")
  await input.dependencies.markJobStage?.(JobPipelineStage.SUMMARIZE_EN)
  const summaryEn = await input.dependencies.summarizeText({
    client: input.client,
    model: input.activeSettings.model,
    systemPrompt: buildSummaryPrompt(
      resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
      "en",
    ),
    sourceText: contentMdEn,
  })
  await input.dependencies.markJobStage?.(JobPipelineStage.SUMMARIZE_ZH)
  const summaryZh = await input.dependencies.summarizeText({
    client: input.client,
    model: input.activeSettings.model,
    systemPrompt: buildSummaryPrompt(
      resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
      "zh",
    ),
    sourceText: contentMdZh,
  })

  await updateArticlePatchWithFallback(input.dependencies, input.article, {
    summaryEn,
    summaryZh,
  })
}

async function processTranslateJob(input: {
  article: ArticleRecord
  activeSettings: LlmSettingsRecord
  client: Parameters<typeof translateText>[0]["client"]
  dependencies: ProcessArticleJobDependencies
}) {
  const titleEn = requireArticleField(input.article.titleEn, "English title")
  const contentMdEn = requireArticleField(input.article.contentMdEn, "English body")
  await input.dependencies.markJobStage?.(JobPipelineStage.TRANSLATE_TITLE)
  const titleZh = await input.dependencies.translateText({
    client: input.client,
    model: input.activeSettings.model,
    systemPrompt: input.activeSettings.translateTitlePrompt,
    sourceText: titleEn,
  })
  await input.dependencies.markJobStage?.(JobPipelineStage.TRANSLATE_CONTENT)
  const contentMdZh = await input.dependencies.translateText({
    client: input.client,
    model: input.activeSettings.model,
    systemPrompt: input.activeSettings.translateContentPrompt,
    sourceText: contentMdEn,
  })
  await input.dependencies.markJobStage?.(JobPipelineStage.SUMMARIZE_EN)
  const summaryEn = await input.dependencies.summarizeText({
    client: input.client,
    model: input.activeSettings.model,
    systemPrompt: buildSummaryPrompt(
      resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
      "en",
    ),
    sourceText: contentMdEn,
  })
  await input.dependencies.markJobStage?.(JobPipelineStage.SUMMARIZE_ZH)
  const summaryZh = await input.dependencies.summarizeText({
    client: input.client,
    model: input.activeSettings.model,
    systemPrompt: buildSummaryPrompt(
      resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
      "zh",
    ),
    sourceText: contentMdZh,
  })

  await updateArticlePatchWithFallback(input.dependencies, input.article, {
    titleZh,
    contentMdZh,
    summaryEn,
    summaryZh,
  })
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function toRawMetaRecord(value: unknown) {
  return value && typeof value === "object"
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function requireArticleField(value: string | null | undefined, label: string) {
  if (!hasText(value)) {
    throw new Error(`${label} is required for this processing step.`)
  }

  return value
}

async function persistArticlePatch(
  dependencies: ProcessArticleJobDependencies,
  article: ArticleRecord,
  patch: ArticlePatch,
) {
  if (!dependencies.updateArticlePatch) {
    return
  }

  await dependencies.updateArticlePatch(article.id, patch)
}

async function updateArticlePatchWithFallback(
  dependencies: ProcessArticleJobDependencies,
  article: ArticleRecord,
  patch: ArticlePatch,
) {
  if (dependencies.updateArticlePatch) {
    await dependencies.updateArticlePatch(article.id, patch)
    return
  }

  await dependencies.updateArticleContent(article.id, {
    titleEn: patch.titleEn ?? article.titleEn,
    titleZh: patch.titleZh ?? article.titleZh ?? "",
    summaryEn: patch.summaryEn ?? article.summaryEn ?? "",
    summaryZh: patch.summaryZh ?? article.summaryZh ?? "",
    contentMdEn:
      patch.contentMdEn ?? requireArticleField(article.contentMdEn, "English body"),
    contentMdZh: patch.contentMdZh ?? article.contentMdZh ?? "",
    ecosystem: patch.ecosystem ?? article.ecosystem,
    riskCategory: patch.riskCategory ?? article.riskCategory,
    tags: patch.tags ?? article.tags,
    contentHash:
      patch.contentHash ??
      article.contentHash ??
      buildContentHash(
        patch.titleEn ?? article.titleEn,
        patch.contentMdEn ?? article.contentMdEn ?? "",
      ),
    rawMeta:
      patch.rawMeta && typeof patch.rawMeta === "object"
        ? (patch.rawMeta as Record<string, unknown>)
        : toRawMetaRecord(article.rawMeta),
  })
}

function buildContentHash(title: string, content: string) {
  return createHash("sha256").update(`${title}\n${content}`).digest("hex")
}

async function markArticleStatus(
  db: ContentDb,
  articleId: string,
  status: typeof ArticleStatus[keyof typeof ArticleStatus],
  error?: string,
) {
  const currentArticle = await db.query.articles.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, articleId),
  })

  await db
    .update(articles)
    .set({
      status,
      rawMeta: error
        ? {
            ...(typeof currentArticle?.rawMeta === "object" && currentArticle?.rawMeta
              ? currentArticle.rawMeta
              : {}),
            processingError: error,
          }
        : currentArticle?.rawMeta ?? null,
    })
    .where(eq(articles.id, articleId))
}

async function updateArticleContent(
  db: ContentDb,
  articleId: string,
  content: {
    titleEn: string
    titleZh: string
    summaryEn: string
    summaryZh: string
      contentMdEn: string
      contentMdZh: string
      ecosystem: string
      riskCategory: string
      tags: string[]
      contentHash: string
      rawMeta: Record<string, unknown>
    },
) {
  await db
    .update(articles)
    .set({
      titleEn: content.titleEn,
      titleZh: content.titleZh,
      summaryEn: content.summaryEn,
      summaryZh: content.summaryZh,
      contentMdEn: content.contentMdEn,
      contentMdZh: content.contentMdZh,
      ecosystem: content.ecosystem,
      riskCategory: content.riskCategory,
      tags: content.tags,
      contentHash: content.contentHash,
      rawMeta: content.rawMeta,
    })
    .where(eq(articles.id, articleId))
}

async function updateArticlePatch(
  db: ContentDb,
  articleId: string,
  patch: ArticlePatch,
) {
  await db.update(articles).set(patch).where(eq(articles.id, articleId))
}

async function processClaimedJob(db: ContentDb, job: JobRecord) {
  try {
    await processArticleJob(job, {
      loadArticle: (articleId: string) =>
        db.query.articles.findFirst({
          where: (table, { eq: whereEq }) => whereEq(table.id, articleId),
        }),
      loadActiveLlmSettings: () =>
        db.query.llmSettings.findFirst({
          where: (table, { eq: whereEq }) => whereEq(table.isActive, true),
        }),
      markArticleStatus: (articleId, status, error) =>
        markArticleStatus(db, articleId, status, error),
      updateArticleContent: (articleId, content) =>
        updateArticleContent(db, articleId, content),
      updateArticlePatch: (articleId, patch) =>
        updateArticlePatch(db, articleId, patch),
      markJobStage: (stage) => markJobStage(db, job.id, stage),
      fetchArticleHtml,
      extractMarkdownFromHtml,
      createOpenAIClient,
      decryptSecret,
      translateText,
      summarizeText,
      generateTags,
    })

    await markJobSucceeded(db, job.id)

    return {
      jobId: job.id,
      articleId: job.articleId,
      status: "succeeded" as const,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await markArticleStatus(db, job.articleId, ArticleStatus.FAILED, message)
    await markJobFailed(db, {
      jobId: job.id,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      error: message,
    })

    return {
      jobId: job.id,
      articleId: job.articleId,
      status: "failed" as const,
      error: message,
    }
  }
}

export async function processNextQueuedJob(db: ContentDb) {
  const job = await claimNextQueuedJob(db)

  if (!job) {
    return null
  }

  return processClaimedJob(db, job)
}

export async function processQueuedJobById(db: ContentDb, jobId: string) {
  const job = await claimQueuedJobById(db, jobId)

  if (!job) {
    return null
  }

  return processClaimedJob(db, job)
}

type ProcessedJobResult = NonNullable<Awaited<ReturnType<typeof processNextQueuedJob>>>

export type ProcessQueuedJobsOptions = {
  batchSize?: number
  processNextJob?: typeof processNextQueuedJob
  processJobById?: typeof processQueuedJobById
  resetStaleJobs?: typeof resetStaleRunningJobs
}

const DEFAULT_WORKER_BATCH_SIZE = 5
const MAX_WORKER_BATCH_SIZE = 20

export function resolveWorkerBatchSize(batchSize?: number) {
  if (!Number.isFinite(batchSize) || !batchSize || batchSize < 1) {
    return DEFAULT_WORKER_BATCH_SIZE
  }

  return Math.min(Math.floor(batchSize), MAX_WORKER_BATCH_SIZE)
}

export async function processQueuedJobs(
  db: ContentDb,
  options: ProcessQueuedJobsOptions = {},
) {
  const results = []
  const batchSize = resolveWorkerBatchSize(options.batchSize)
  const processNextJob = options.processNextJob ?? processNextQueuedJob
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs

  await resetStaleJobs(db)

  while (results.length < batchSize) {
    const result = await processNextJob(db)

    if (!result) {
      break
    }

    results.push(result)
  }

  return results
}

export async function processQueuedJobsByIds(
  db: ContentDb,
  jobIds: string[],
  options: ProcessQueuedJobsOptions = {},
) {
  const results: ProcessedJobResult[] = []
  const batchSize = resolveWorkerBatchSize(options.batchSize)
  const processJobById = options.processJobById ?? processQueuedJobById
  const resetStaleJobs = options.resetStaleJobs ?? resetStaleRunningJobs

  await resetStaleJobs(db)

  for (const jobId of jobIds) {
    if (results.length >= batchSize) {
      break
    }

    const result = await processJobById(db, jobId)

    if (result) {
      results.push(result)
    }
  }

  return results
}
