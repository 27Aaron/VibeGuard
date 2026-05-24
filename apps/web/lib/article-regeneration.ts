import { createHash } from "node:crypto"

import {
  classifySecurityContent,
  extractMarkdownFromHtml,
  fetchArticleHtml,
} from "@vibeguard/content"
import {
  buildLocalizedSummaryPrompt,
  classifyRelevance as classifyRelevanceWithModel,
  createOpenAIClient,
  decryptSecret,
  generateTags as generateTagsWithModel,
  summarizeText as summarizeWithModel,
  translateText as translateWithModel,
  type UsageResult,
} from "@vibeguard/llm"
import { ArticleStatus } from "@vibeguard/shared"

export const ARTICLE_REGENERATION_TARGETS = [
  "fetch-source",
  "extract-content",
  "classify-relevance",
  "skip-relevance",
  "title-zh",
  "content-zh",
  "summary-en",
  "summary-zh",
  "tags",
] as const

export type ArticleRegenerationTarget = (typeof ARTICLE_REGENERATION_TARGETS)[number]

type RegeneratableArticle = {
  id: string
  url: string
  titleEn: string
  titleZh: string | null
  summaryEn: string | null
  summaryZh: string | null
  contentMdEn: string | null
  contentMdZh: string | null
  tags: string[]
  status: ArticleStatus
  rawMeta: unknown
  ecosystem: string
  riskCategory: string
}

type ActiveSettings = {
  baseUrl: string
  apiKeyEncrypted: string
  model: string
  relevancePrompt: string
  translateTitlePrompt: string
  translateContentPrompt: string
  summaryPromptEn: string
  summaryPromptZh: string
  tagPrompt: string
}

type RegenerationDependencies = {
  fetchArticleHtml: typeof fetchArticleHtml
  extractMarkdownFromHtml: typeof extractMarkdownFromHtml
  classifySecurityContent: typeof classifySecurityContent
  createOpenAIClient: typeof createOpenAIClient
  decryptSecret: typeof decryptSecret
  translateText: typeof translateWithModel
  summarizeText: typeof summarizeWithModel
  classifyRelevance: typeof classifyRelevanceWithModel
  generateTags?: typeof generateTagsWithModel
  logLlmUsage?: (input: {
    articleId: string
    taskType: string
    model: string
    usage: UsageResult | null
    responseTimeMs: number
  }) => Promise<void>
}

export const defaultDependencies: RegenerationDependencies = {
  fetchArticleHtml,
  extractMarkdownFromHtml,
  classifySecurityContent,
  createOpenAIClient,
  decryptSecret,
  translateText: translateWithModel,
  summarizeText: summarizeWithModel,
  classifyRelevance: classifyRelevanceWithModel,
  generateTags: generateTagsWithModel,
}

function hasCompleteContent(article: RegeneratableArticle, patch: Partial<RegeneratableArticle>) {
  const next = {
    ...article,
    ...patch,
  }

  return Boolean(
    next.titleZh &&
      next.contentMdEn &&
      next.contentMdZh &&
      next.summaryEn &&
      next.summaryZh,
  )
}

function toRawMetaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {}
}

function buildContentHash(title: string, content: string) {
  // 对标题中的换行符进行归一化处理，防止因标题中嵌入的换行符与分隔符换行符不同
  // 而导致的哈希碰撞问题。
  const normalizedTitle = title.replace(/[\r\n]+/g, " ")
  return createHash("sha256").update(`${normalizedTitle}\n${content}`).digest("hex")
}

const FILTERED_BLOCKED_TARGETS = new Set<ArticleRegenerationTarget>([
  "title-zh",
  "content-zh",
  "summary-en",
  "summary-zh",
  "tags",
])

export function getRegenerationRequirementError(
  article: RegeneratableArticle,
  target: ArticleRegenerationTarget,
  lang: "zh" | "en",
) {
  if (article.status === ArticleStatus.FILTERED && FILTERED_BLOCKED_TARGETS.has(target)) {
    return lang === "zh"
      ? "当前文章已被过滤"
      : "This article has been filtered"
  }

  if (target === "skip-relevance") {
    if (article.status !== ArticleStatus.FILTERED) {
      return lang === "zh"
        ? "仅已过滤的文章可以跳过相关性判断。"
        : "Only filtered articles can skip the relevance check."
    }
    return null
  }

  if (target === "classify-relevance") {
    if (!article.titleEn.trim() || !String(article.contentMdEn ?? "").trim()) {
      return lang === "zh"
        ? "当前文章缺少英文标题或英文正文，无法重新判断相关性。"
        : "An English title and English body are required to re-classify relevance."
    }
    return null
  }

  if (target === "title-zh" && !article.titleEn.trim()) {
    return lang === "zh"
      ? "当前文章缺少英文标题，无法重新生成中文标题。"
      : "The article has no English title, so the Chinese title cannot be regenerated."
  }

  if (target === "content-zh" && !String(article.contentMdEn ?? "").trim()) {
    return lang === "zh"
      ? "当前文章缺少英文正文，无法重新生成中文正文。"
      : "The article has no English body, so the Chinese body cannot be regenerated."
  }

  if (target === "summary-en" && !String(article.contentMdEn ?? "").trim()) {
    return lang === "zh"
      ? "当前文章缺少英文正文，无法重新生成英文摘要。"
      : "The article has no English body, so the English summary cannot be regenerated."
  }

  if (target === "tags" && !String(article.contentMdEn ?? "").trim()) {
    return lang === "zh"
      ? "当前文章缺少英文正文，无法重新生成标签。"
      : "The article has no English body, so tags cannot be regenerated."
  }

  if (target === "summary-zh" && !String(article.contentMdEn ?? "").trim()) {
    return lang === "zh"
      ? "当前文章缺少英文正文，无法重新生成中文摘要。"
      : "The article has no English body, so the Chinese summary cannot be regenerated."
  }

  return null
}

export async function regenerateArticleTarget(
  input: {
    article: RegeneratableArticle
    settings: ActiveSettings
    target: ArticleRegenerationTarget
  },
  dependencies: RegenerationDependencies = defaultDependencies,
) {
  const logUsage = async (taskType: string, usage: UsageResult | null, start: number) => {
    if (!dependencies.logLlmUsage || !usage) return
    await dependencies.logLlmUsage({
      articleId: input.article.id,
      taskType,
      model: input.settings.model,
      usage,
      responseTimeMs: Date.now() - start,
    })
  }

  if (input.target === "fetch-source") {
    // 完整流水线：抓取→提取→相关性→如果相关则翻译/摘要/标签
    const html = await dependencies.fetchArticleHtml(input.article.url)
    const extracted = await dependencies.extractMarkdownFromHtml(html, input.article.url)
    const titleEn = extracted.title
    const contentMdEn = extracted.contentMd
    const rawMeta = toRawMetaRecord(input.article.rawMeta)
    rawMeta.extraction = {
      author: extracted.author,
      description: extracted.description,
      publishedAt: extracted.publishedAt,
      siteName: extracted.siteName,
    }

    // 相关性判断
    const apiKey = dependencies.decryptSecret(input.settings.apiKeyEncrypted)
    if (!apiKey) {
      throw new Error("Active LLM settings could not be decrypted.")
    }
    const client = dependencies.createOpenAIClient({
      baseUrl: input.settings.baseUrl,
      apiKey,
    })
    let start = Date.now()
    const relevanceResult = await dependencies.classifyRelevance({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.relevancePrompt,
      sourceText: `${titleEn}\n\n${contentMdEn.slice(0, 4000)}`,
    })
    await logUsage("classify_relevance", relevanceResult.usage, start)
    const relevance = relevanceResult.result

    if (!relevance.relevant) {
      rawMeta.relevanceFilter = {
        reason: relevance.reason,
        checkedAt: new Date().toISOString(),
      }
      const classification = dependencies.classifySecurityContent({
        url: input.article.url,
        title: titleEn,
        summary: extracted.description ?? "",
        content: contentMdEn,
      })
      return {
        patch: {
          titleEn,
          contentMdEn,
          contentHash: buildContentHash(titleEn, contentMdEn),
          ecosystem: classification.ecosystem,
          riskCategory: classification.riskCategory,
          rawMeta,
        },
        nextStatus: ArticleStatus.FILTERED,
      }
    }

    if (rawMeta.relevanceFilter) {
      delete rawMeta.relevanceFilter
    }

    // 相关：继续翻译/摘要/标签
    start = Date.now()
    const titleZhResult = await dependencies.translateText({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.translateTitlePrompt,
      sourceText: titleEn,
    })
    await logUsage("translate_title", titleZhResult.usage, start)
    const titleZh = titleZhResult.result

    start = Date.now()
    const contentMdZhResult = await dependencies.translateText({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.translateContentPrompt,
      sourceText: contentMdEn,
    })
    await logUsage("translate_content", contentMdZhResult.usage, start)
    const contentMdZh = contentMdZhResult.result

    start = Date.now()
    const summaryEnResult = await dependencies.summarizeText({
      client,
      model: input.settings.model,
      systemPrompt: buildLocalizedSummaryPrompt(input.settings.summaryPromptEn, "en"),
      sourceText: contentMdEn,
    })
    await logUsage("summarize_en", summaryEnResult.usage, start)
    const summaryEn = summaryEnResult.result

    start = Date.now()
    const summaryZhResult = await dependencies.summarizeText({
      client,
      model: input.settings.model,
      systemPrompt: buildLocalizedSummaryPrompt(input.settings.summaryPromptZh, "zh"),
      sourceText: contentMdZh,
    })
    await logUsage("summarize_zh", summaryZhResult.usage, start)
    const summaryZh = summaryZhResult.result

    const classification = dependencies.classifySecurityContent({
      url: input.article.url,
      title: titleEn,
      summary: extracted.description ?? summaryEn,
      content: contentMdEn,
    })
    const tagGenerator = dependencies.generateTags ?? generateTagsWithModel
    start = Date.now()
    const tagsResult = await tagGenerator({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.tagPrompt,
      sourceText: contentMdEn,
    })
    await logUsage("generate_tags", tagsResult.usage, start)
    const tags = tagsResult.result

    return {
      patch: {
        titleEn,
        contentMdEn,
        contentMdZh,
        titleZh,
        summaryEn,
        summaryZh,
        tags: tags.length > 0 ? tags : classification.tags,
        contentHash: buildContentHash(titleEn, contentMdEn),
        ecosystem: classification.ecosystem,
        riskCategory: classification.riskCategory,
        rawMeta,
      },
      nextStatus: ArticleStatus.READY,
    }
  }

  if (input.target === "extract-content") {
    const html = await dependencies.fetchArticleHtml(input.article.url)
    const extracted = await dependencies.extractMarkdownFromHtml(html, input.article.url)
    const titleEn = extracted.title
    const contentMdEn = extracted.contentMd
    const rawMeta = toRawMetaRecord(input.article.rawMeta)
    rawMeta.extraction = {
      author: extracted.author,
      description: extracted.description,
      publishedAt: extracted.publishedAt,
      siteName: extracted.siteName,
    }
    const classification = dependencies.classifySecurityContent({
      url: input.article.url,
      title: titleEn,
      summary: extracted.description ?? "",
      content: contentMdEn,
    })

    return {
      patch: {
        titleEn,
        contentMdEn,
        contentHash: buildContentHash(titleEn, contentMdEn),
        ecosystem: classification.ecosystem,
        riskCategory: classification.riskCategory,
        rawMeta,
      },
      nextStatus: hasCompleteContent(input.article, { titleEn, contentMdEn })
        ? ArticleStatus.READY
        : input.article.status,
    }
  }

  if (input.target === "classify-relevance") {
    const apiKey = dependencies.decryptSecret(input.settings.apiKeyEncrypted)
    if (!apiKey) {
      throw new Error("Active LLM settings could not be decrypted.")
    }
    const client = dependencies.createOpenAIClient({
      baseUrl: input.settings.baseUrl,
      apiKey,
    })
    const titleEn = input.article.titleEn
    const contentMdEn = input.article.contentMdEn ?? ""
    let start = Date.now()
    const relevanceResult = await dependencies.classifyRelevance({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.relevancePrompt,
      sourceText: `${titleEn}\n\n${contentMdEn.slice(0, 4000)}`,
    })
    await logUsage("classify_relevance", relevanceResult.usage, start)
    const relevance = relevanceResult.result
    if (!relevance.relevant) {
      const rawMeta = toRawMetaRecord(input.article.rawMeta)
      rawMeta.relevanceFilter = {
        reason: relevance.reason,
        checkedAt: new Date().toISOString(),
      }
      return {
        patch: { rawMeta },
        nextStatus: ArticleStatus.FILTERED,
      }
    }
    const rawMeta = toRawMetaRecord(input.article.rawMeta)
    if (rawMeta.relevanceFilter) {
      delete rawMeta.relevanceFilter
    }
    return {
      patch: { rawMeta },
      nextStatus: hasCompleteContent(input.article, {})
        ? ArticleStatus.READY
        : input.article.status,
    }
  }

  if (input.target === "skip-relevance") {
    const rawMeta = toRawMetaRecord(input.article.rawMeta)
    if (rawMeta.relevanceFilter) {
      delete rawMeta.relevanceFilter
    }
    return {
      patch: { rawMeta },
      nextStatus: hasCompleteContent(input.article, {})
        ? ArticleStatus.READY
        : input.article.status,
    }
  }

  const apiKey = dependencies.decryptSecret(input.settings.apiKeyEncrypted)
  if (!apiKey) {
    throw new Error("Active LLM settings could not be decrypted.")
  }
  const client = dependencies.createOpenAIClient({
    baseUrl: input.settings.baseUrl,
    apiKey,
  })

  if (input.target === "title-zh") {
    let start = Date.now()
    const titleZhResult = await dependencies.translateText({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.translateTitlePrompt,
      sourceText: input.article.titleEn,
    })
    await logUsage("translate_title", titleZhResult.usage, start)
    const titleZh = titleZhResult.result

    return {
      patch: {
        titleZh,
      },
      nextStatus: hasCompleteContent(input.article, { titleZh })
        ? ArticleStatus.READY
        : input.article.status,
    }
  }

  if (input.target === "content-zh") {
    let start = Date.now()
    const contentMdZhResult = await dependencies.translateText({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.translateContentPrompt,
      sourceText: input.article.contentMdEn ?? "",
    })
    await logUsage("translate_content", contentMdZhResult.usage, start)
    const contentMdZh = contentMdZhResult.result

    return {
      patch: {
        contentMdZh,
      },
      nextStatus: hasCompleteContent(input.article, { contentMdZh })
        ? ArticleStatus.READY
        : input.article.status,
    }
  }

  if (input.target === "summary-en") {
    let start = Date.now()
    const summaryEnResult = await dependencies.summarizeText({
      client,
      model: input.settings.model,
      systemPrompt: buildLocalizedSummaryPrompt(input.settings.summaryPromptEn, "en"),
      sourceText: input.article.contentMdEn ?? "",
    })
    await logUsage("summarize_en", summaryEnResult.usage, start)
    const summaryEn = summaryEnResult.result

    return {
      patch: {
        summaryEn,
      },
      nextStatus: hasCompleteContent(input.article, { summaryEn })
        ? ArticleStatus.READY
        : input.article.status,
    }
  }

  if (input.target === "tags") {
    const tagGenerator = dependencies.generateTags ?? generateTagsWithModel
    let start = Date.now()
    const tagsResult = await tagGenerator({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.tagPrompt,
      sourceText: input.article.contentMdEn ?? "",
    })
    await logUsage("generate_tags", tagsResult.usage, start)

    return {
      patch: {
        tags: tagsResult.result,
      },
      nextStatus: hasCompleteContent(input.article, {})
        ? ArticleStatus.READY
        : input.article.status,
    }
  }

  let start = Date.now()
  const summaryZhResult = await dependencies.summarizeText({
    client,
    model: input.settings.model,
    systemPrompt: buildLocalizedSummaryPrompt(input.settings.summaryPromptZh, "zh"),
    sourceText: input.article.contentMdEn ?? "",
  })
  await logUsage("summarize_zh", summaryZhResult.usage, start)

  const summaryZh = summaryZhResult.result
  return {
    patch: {
      summaryZh,
    },
    nextStatus: hasCompleteContent(input.article, { summaryZh })
      ? ArticleStatus.READY
      : input.article.status,
  }
}
