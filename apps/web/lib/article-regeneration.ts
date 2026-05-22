import {
  buildLocalizedSummaryPrompt,
  createOpenAIClient,
  decryptSecret,
  generateTags as generateTagsWithModel,
  summarizeText as summarizeWithModel,
  translateText as translateWithModel,
} from "@vibeguard/llm"
import { ArticleStatus } from "@vibeguard/shared"

export const ARTICLE_REGENERATION_TARGETS = [
  "full",
  "title-zh",
  "content-zh",
  "summary-en",
  "summary-zh",
  "tags",
] as const

export type ArticleRegenerationTarget = (typeof ARTICLE_REGENERATION_TARGETS)[number]

type RegeneratableArticle = {
  id: string
  titleEn: string
  titleZh: string | null
  summaryEn: string | null
  summaryZh: string | null
  contentMdEn: string | null
  contentMdZh: string | null
  tags: string[]
  status: ArticleStatus
  rawMeta: unknown
}

type ActiveSettings = {
  baseUrl: string
  apiKeyEncrypted: string
  model: string
  translateTitlePrompt: string
  translateContentPrompt: string
  summaryPromptEn: string
  summaryPromptZh: string
  tagPrompt: string
}

type RegenerationDependencies = {
  createOpenAIClient: typeof createOpenAIClient
  decryptSecret: typeof decryptSecret
  translateText: typeof translateWithModel
  summarizeText: typeof summarizeWithModel
  generateTags?: typeof generateTagsWithModel
}

const defaultDependencies: RegenerationDependencies = {
  createOpenAIClient,
  decryptSecret,
  translateText: translateWithModel,
  summarizeText: summarizeWithModel,
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

export function getRegenerationRequirementError(
  article: RegeneratableArticle,
  target: Exclude<ArticleRegenerationTarget, "full">,
  lang: "zh" | "en",
) {
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

  if (target === "summary-zh" && !String(article.contentMdZh ?? "").trim()) {
    return lang === "zh"
      ? "当前文章缺少中文正文，请先重新生成中文正文。"
      : "The article has no Chinese body yet. Regenerate the Chinese body first."
  }

  return null
}

export async function regenerateArticleTarget(
  input: {
    article: RegeneratableArticle
    settings: ActiveSettings
    target: Exclude<ArticleRegenerationTarget, "full">
  },
  dependencies: RegenerationDependencies = defaultDependencies,
) {
  const apiKey = dependencies.decryptSecret(input.settings.apiKeyEncrypted)

  if (!apiKey) {
    throw new Error("Active LLM settings could not be decrypted.")
  }

  const client = dependencies.createOpenAIClient({
    baseUrl: input.settings.baseUrl,
    apiKey,
  })

  if (input.target === "title-zh") {
    const titleZh = await dependencies.translateText({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.translateTitlePrompt,
      sourceText: input.article.titleEn,
    })

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
    const contentMdZh = await dependencies.translateText({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.translateContentPrompt,
      sourceText: input.article.contentMdEn ?? "",
    })

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
    const summaryEn = await dependencies.summarizeText({
      client,
      model: input.settings.model,
      systemPrompt: buildLocalizedSummaryPrompt(input.settings.summaryPromptEn, "en"),
      sourceText: input.article.contentMdEn ?? "",
    })

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
    const tags = await tagGenerator({
      client,
      model: input.settings.model,
      systemPrompt: input.settings.tagPrompt,
      sourceText: input.article.contentMdEn ?? "",
    })

    return {
      patch: {
        tags,
      },
      nextStatus: hasCompleteContent(input.article, {})
        ? ArticleStatus.READY
        : input.article.status,
    }
  }

  const summaryZh = await dependencies.summarizeText({
    client,
    model: input.settings.model,
    systemPrompt: buildLocalizedSummaryPrompt(input.settings.summaryPromptZh, "zh"),
    sourceText: input.article.contentMdZh ?? "",
  })

  return {
    patch: {
      summaryZh,
    },
    nextStatus: hasCompleteContent(input.article, { summaryZh })
      ? ArticleStatus.READY
      : input.article.status,
  }
}
