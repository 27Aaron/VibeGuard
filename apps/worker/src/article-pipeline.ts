import { createHash } from "node:crypto"

import { fetchArticleHtml } from "@vibeguard/content/extract/article-html"
import {
  classifySecurityContent,
  extractMarkdownFromHtml,
  type ExtractedArticle,
} from "@vibeguard/content"
import { articles, llmSettings, schema } from "@vibeguard/db"
import {
  classifyRelevance,
  createOpenAIClient,
  decryptSecret,
  generateTags,
  DEFAULT_TAG_PROMPT,
  resolveTagPrompt,
  summarizeText,
  translateText,
} from "@vibeguard/llm"
import { ArticleStatus, JobPipelineStage, JobType } from "@vibeguard/shared"

type ArticleRecord = typeof articles.$inferSelect
type LlmSettingsRecord = typeof llmSettings.$inferSelect
type JobRecord = typeof schema.processingJobs.$inferSelect
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

    // 相关性检查：提取内容后立即判断，不相关的文章跳过后续所有 LLM 步骤
    await input.dependencies.markJobStage?.(JobPipelineStage.CLASSIFY_RELEVANCE)
    const relevance = await classifyRelevance({
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: input.activeSettings.relevancePrompt,
      sourceText: `${titleEn}\n\n${contentMdEn.slice(0, 4000)}`,
    })
    if (!relevance.relevant) {
      rawMeta.relevanceFilter = {
        reason: relevance.reason,
        checkedAt: new Date().toISOString(),
      }
      await persistArticlePatch(input.dependencies, input.article, { rawMeta })
      return ArticleStatus.FILTERED
    }
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
  const generatedTags = await generateArticleTags({
    dependencies: input.dependencies,
    client: input.client,
    model: input.activeSettings.model,
    systemPrompt: resolveTagPrompt(input.activeSettings.tagPrompt || DEFAULT_TAG_PROMPT),
    sourceText: requiredContentMdEn,
  })
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

  return ArticleStatus.READY
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
