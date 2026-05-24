import { createHash } from "node:crypto"

import { fetchArticleHtml } from "@vibeguard/content/extract/article-html"
import {
  classifySecurityContent,
  extractMarkdownFromHtml,
  type ExtractedArticle,
} from "@vibeguard/content"
import { articles, llmSettings, schema } from "@vibeguard/db"
import {
  buildLocalizedSummaryPrompt,
  classifyRelevance,
  createOpenAIClient,
  decryptSecret,
  generateTags,
  DEFAULT_TAG_PROMPT,
  resolveTagPrompt,
  summarizeText,
  translateText,
} from "@vibeguard/llm"
import { ArticleEcosystem, ArticleRiskCategory, ArticleStatus, JobPipelineStage, JobType } from "@vibeguard/shared"
import type { UsageResult } from "@vibeguard/llm"

type ArticleRecord = typeof articles.$inferSelect
type LlmSettingsRecord = typeof llmSettings.$inferSelect
type JobRecord = typeof schema.processingJobs.$inferSelect
export class JobPausedSignal extends Error {
  constructor(message = "Job pause requested.") {
    super(message)
    this.name = "JobPausedSignal"
  }
}

export class JobCancelledSignal extends Error {
  constructor(message = "Job cancel requested.") {
    super(message)
    this.name = "JobCancelledSignal"
  }
}

type ProcessArticleFinalStatus =
  | typeof ArticleStatus.READY
  | typeof ArticleStatus.FILTERED
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
      ecosystem: ArticleEcosystem
      riskCategory: ArticleRiskCategory
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
  checkJobControl?: () => Promise<void>
  logLlmUsage?: (input: {
    articleId: string
    jobId?: string
    taskType: string
    model: string
    usage: UsageResult | null
    responseTimeMs: number
  }) => Promise<void>
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
  job: Pick<JobRecord, "articleId"> & Partial<Pick<JobRecord, "jobType" | "pipelineStage">>,
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
  await checkJobControl(dependencies)
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

  const finalStatus = await processExtractJob({
    article,
    activeSettings,
    client,
    dependencies,
  })
  await dependencies.markArticleStatus(article.id, finalStatus)
}

async function processExtractJob(input: {
  article: ArticleRecord
  activeSettings: LlmSettingsRecord
  client: Parameters<typeof translateText>[0]["client"]
  dependencies: ProcessArticleJobDependencies
}): Promise<ProcessArticleFinalStatus> {
  const rawMeta = toRawMetaRecord(input.article.rawMeta)
  let titleEn = input.article.titleEn
  let contentMdEn = input.article.contentMdEn
  let titleZh = input.article.titleZh
  let contentMdZh = input.article.contentMdZh
  let summaryEn = input.article.summaryEn
  let summaryZh = input.article.summaryZh

  if (!hasText(titleEn) || !hasText(contentMdEn)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.FETCH_SOURCE)
    const html = await input.dependencies.fetchArticleHtml(input.article.url)
    await markStageAndCheck(input.dependencies, JobPipelineStage.EXTRACT_CONTENT)
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
    await checkJobControl(input.dependencies)
  }

  const requiredTitleEn = requireArticleField(titleEn, "English title")
  const requiredContentMdEn = requireArticleField(contentMdEn, "English body")

  // 相关性检查：提取内容后立即判断，不相关的文章跳过后续所有 LLM 步骤。
  // If a paused job resumes after extraction, raw content already exists, but
  // the relevance marker may not. Run the check before translation in that case.
  if (!hasRelevanceCheck(rawMeta)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.CLASSIFY_RELEVANCE)
    const relevanceResult = await timedLlmCall(
      () => classifyRelevance({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: input.activeSettings.relevancePrompt,
        sourceText: `${requiredTitleEn}\n\n${requiredContentMdEn.slice(0, 4000)}`,
      }),
      input.dependencies,
      { articleId: input.article.id, taskType: "classify_relevance", model: input.activeSettings.model },
    )
    const relevance = relevanceResult.result
    rawMeta.relevanceCheck = {
      relevant: relevance.relevant,
      reason: relevance.reason,
      checkedAt: new Date().toISOString(),
    }
    if (!relevance.relevant) {
      rawMeta.relevanceFilter = {
        reason: relevance.reason,
        checkedAt: new Date().toISOString(),
      }
      await persistArticlePatch(input.dependencies, input.article, { rawMeta })
      await checkJobControl(input.dependencies)
      return ArticleStatus.FILTERED
    }

    await persistArticlePatch(input.dependencies, input.article, { rawMeta })
    await checkJobControl(input.dependencies)
  }

  if (!hasText(titleZh)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.TRANSLATE_TITLE)
    const titleZhResult = await timedLlmCall(
      () => input.dependencies.translateText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: input.activeSettings.translateTitlePrompt,
        sourceText: requiredTitleEn,
      }),
      input.dependencies,
      { articleId: input.article.id, taskType: "translate_title", model: input.activeSettings.model },
    )
    titleZh = titleZhResult.result
    await persistArticlePatch(input.dependencies, input.article, { titleZh })
    await checkJobControl(input.dependencies)
  }

  if (!hasText(contentMdZh)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.TRANSLATE_CONTENT)
    const contentMdZhResult = await timedLlmCall(
      () => input.dependencies.translateText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: input.activeSettings.translateContentPrompt,
        sourceText: requiredContentMdEn,
      }),
      input.dependencies,
      { articleId: input.article.id, taskType: "translate_content", model: input.activeSettings.model },
    )
    contentMdZh = contentMdZhResult.result
    await persistArticlePatch(input.dependencies, input.article, { contentMdZh })
    await checkJobControl(input.dependencies)
  }

  if (!hasText(summaryEn)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_EN)
    const summaryEnResult = await timedLlmCall(
      () => input.dependencies.summarizeText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: buildLocalizedSummaryPrompt(
          resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
          "en",
        ),
        sourceText: requiredContentMdEn,
      }),
      input.dependencies,
      { articleId: input.article.id, taskType: "summarize_en", model: input.activeSettings.model },
    )
    summaryEn = summaryEnResult.result
    await persistArticlePatch(input.dependencies, input.article, { summaryEn })
    await checkJobControl(input.dependencies)
  }

  const requiredContentMdZh = requireArticleField(contentMdZh, "Chinese body")

  if (!hasText(summaryZh)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_ZH)
    const summaryZhResult = await timedLlmCall(
      () => input.dependencies.summarizeText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: buildLocalizedSummaryPrompt(
          resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
          "zh",
        ),
        sourceText: requiredContentMdZh,
      }),
      input.dependencies,
      { articleId: input.article.id, taskType: "summarize_zh", model: input.activeSettings.model },
    )
    summaryZh = summaryZhResult.result
    await persistArticlePatch(input.dependencies, input.article, { summaryZh })
    await checkJobControl(input.dependencies)
  }

  const requiredSummaryEn = requireArticleField(summaryEn, "English summary")
  await markStageAndCheck(input.dependencies, JobPipelineStage.GENERATE_TAGS)
  const [classification, generatedTags] = await Promise.all([
    Promise.resolve(classifySecurityContent({
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
    })),
    generateArticleTags({
      dependencies: input.dependencies,
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: resolveTagPrompt(input.activeSettings.tagPrompt || DEFAULT_TAG_PROMPT),
      sourceText: requiredContentMdEn,
      articleId: input.article.id,
    }),
  ])
  const tags = generatedTags.length > 0 ? generatedTags : classification.tags

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
  await checkJobControl(input.dependencies)

  return ArticleStatus.READY
}

async function generateArticleTags(input: {
  dependencies: ProcessArticleJobDependencies
  client: Parameters<typeof generateTags>[0]["client"]
  model: string
  systemPrompt: string
  sourceText: string
  articleId: string
}) {
  try {
    const tagGenerator = input.dependencies.generateTags ?? generateTags
    const tagsResult = await timedLlmCall(
      () => tagGenerator({
        client: input.client,
        model: input.model,
        systemPrompt: input.systemPrompt,
        sourceText: input.sourceText,
      }),
      input.dependencies,
      { articleId: input.articleId, taskType: "generate_tags", model: input.model },
    )

    return tagsResult.result
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
  await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_EN)
  const summaryEnResult = await timedLlmCall(
    () => input.dependencies.summarizeText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: buildLocalizedSummaryPrompt(
        resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
        "en",
      ),
      sourceText: contentMdEn,
    }),
    input.dependencies,
    { articleId: input.article.id, taskType: "summarize_en", model: input.activeSettings.model },
  )
  await checkJobControl(input.dependencies)
  await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_ZH)
  const summaryZhResult = await timedLlmCall(
    () => input.dependencies.summarizeText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: buildLocalizedSummaryPrompt(
        resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
        "zh",
      ),
      sourceText: contentMdZh,
    }),
    input.dependencies,
    { articleId: input.article.id, taskType: "summarize_zh", model: input.activeSettings.model },
  )

  await updateArticlePatchWithFallback(input.dependencies, input.article, {
    summaryEn: summaryEnResult.result,
    summaryZh: summaryZhResult.result,
  })
  await checkJobControl(input.dependencies)
}

async function processTranslateJob(input: {
  article: ArticleRecord
  activeSettings: LlmSettingsRecord
  client: Parameters<typeof translateText>[0]["client"]
  dependencies: ProcessArticleJobDependencies
}) {
  const titleEn = requireArticleField(input.article.titleEn, "English title")
  const contentMdEn = requireArticleField(input.article.contentMdEn, "English body")
  await markStageAndCheck(input.dependencies, JobPipelineStage.TRANSLATE_TITLE)
  const titleZhResult = await timedLlmCall(
    () => input.dependencies.translateText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: input.activeSettings.translateTitlePrompt,
      sourceText: titleEn,
    }),
    input.dependencies,
    { articleId: input.article.id, taskType: "translate_title", model: input.activeSettings.model },
  )
  await checkJobControl(input.dependencies)
  await markStageAndCheck(input.dependencies, JobPipelineStage.TRANSLATE_CONTENT)
  const contentMdZhResult = await timedLlmCall(
    () => input.dependencies.translateText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: input.activeSettings.translateContentPrompt,
      sourceText: contentMdEn,
    }),
    input.dependencies,
    { articleId: input.article.id, taskType: "translate_content", model: input.activeSettings.model },
  )
  await checkJobControl(input.dependencies)
  await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_EN)
  const summaryEnResult = await timedLlmCall(
    () => input.dependencies.summarizeText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: buildLocalizedSummaryPrompt(
        resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
        "en",
      ),
      sourceText: contentMdEn,
    }),
    input.dependencies,
    { articleId: input.article.id, taskType: "summarize_en", model: input.activeSettings.model },
  )
  await checkJobControl(input.dependencies)
  await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_ZH)
  const summaryZhResult = await timedLlmCall(
    () => input.dependencies.summarizeText({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: buildLocalizedSummaryPrompt(
        resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
        "zh",
      ),
      sourceText: contentMdZhResult.result,
    }),
    input.dependencies,
    { articleId: input.article.id, taskType: "summarize_zh", model: input.activeSettings.model },
  )

  await updateArticlePatchWithFallback(input.dependencies, input.article, {
    titleZh: titleZhResult.result,
    contentMdZh: contentMdZhResult.result,
    summaryEn: summaryEnResult.result,
    summaryZh: summaryZhResult.result,
  })
  await checkJobControl(input.dependencies)
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function toRawMetaRecord(value: unknown) {
  return value && typeof value === "object"
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function hasRelevanceCheck(rawMeta: Record<string, unknown>) {
  const relevanceCheck = rawMeta.relevanceCheck

  return Boolean(
    relevanceCheck &&
      typeof relevanceCheck === "object" &&
      typeof (relevanceCheck as { relevant?: unknown }).relevant === "boolean",
  )
}

async function markStageAndCheck(
  dependencies: ProcessArticleJobDependencies,
  stage: typeof JobPipelineStage[keyof typeof JobPipelineStage],
) {
  await dependencies.markJobStage?.(stage)
  await checkJobControl(dependencies)
}

async function checkJobControl(dependencies: ProcessArticleJobDependencies) {
  await dependencies.checkJobControl?.()
}

function requireArticleField(value: string | null | undefined, label: string) {
  if (!hasText(value)) {
    throw new Error(`${label} is required for this processing step.`)
  }

  return value
}

type LlmCallResult<T> = { result: T; usage: UsageResult | null }

async function timedLlmCall<T>(
  fn: () => Promise<LlmCallResult<T>>,
  deps: ProcessArticleJobDependencies,
  input: {
    articleId: string
    taskType: string
    model: string
  },
): Promise<LlmCallResult<T>> {
  const start = Date.now()
  const response = await fn()
  const responseTimeMs = Date.now() - start

  if (deps.logLlmUsage) {
    await deps.logLlmUsage({
      articleId: input.articleId,
      taskType: input.taskType,
      model: input.model,
      usage: response.usage,
      responseTimeMs,
    })
  }

  return response
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
  try {
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
  } catch (error) {
    console.error(
      `updateArticlePatchWithFallback failed for article ${article.id}:`,
      error,
    )
    throw new Error(
      `Failed to persist article patch for ${article.id}`,
      { cause: error },
    )
  }
}

function buildContentHash(title: string, content: string) {
  return createHash("sha256").update(`${title}\n${content}`).digest("hex")
}
