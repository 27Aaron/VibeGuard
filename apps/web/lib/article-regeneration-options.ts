import {
  getRegenerationRequirementError,
  type ArticleRegenerationTarget,
} from "./article-regeneration"

type RegenerationOptionArticle = {
  url: string
  titleEn: string
  contentMdEn: string | null
  contentMdZh: string | null
}

export type ArticleRegenerationOption = {
  target: ArticleRegenerationTarget
  label: string
  description: string
  disabled: boolean
  disabledReason: string | null
}

const REGENERATION_TARGET_ORDER: ArticleRegenerationTarget[] = [
  "fetch-source",
  "extract-content",
  "classify-relevance",
  "title-zh",
  "content-zh",
  "summary-en",
  "summary-zh",
  "tags",
]

export function buildArticleRegenerationOptions(
  article: RegenerationOptionArticle,
  lang: "zh" | "en",
): ArticleRegenerationOption[] {
  return REGENERATION_TARGET_ORDER.map((target) => {
    const label = getRegenerationOptionLabel(target, lang)
    const description = getRegenerationOptionDescription(target, lang)

    if (target === "fetch-source" || target === "extract-content") {
      return {
        target,
        label,
        description,
        disabled: false,
        disabledReason: null,
      }
    }

    const disabledReason = getRegenerationRequirementError(
      {
        id: "preview",
        url: article.url,
        titleEn: article.titleEn,
        titleZh: null,
        summaryEn: null,
        summaryZh: null,
        contentMdEn: article.contentMdEn,
        contentMdZh: article.contentMdZh,
        tags: [],
        status: "ready",
        rawMeta: null,
        ecosystem: "unknown",
        riskCategory: "unknown",
      },
      target,
      lang,
    )

    return {
      target,
      label,
      description,
      disabled: Boolean(disabledReason),
      disabledReason: mapDisabledReason(disabledReason, target, lang),
    }
  })
}

function getRegenerationOptionLabel(
  target: ArticleRegenerationTarget,
  lang: "zh" | "en",
) {
  if (lang === "zh") {
    switch (target) {
      case "fetch-source":
        return "原文抓取"
      case "extract-content":
        return "正文提取"
      case "classify-relevance":
        return "相关性判断"
      case "title-zh":
        return "标题翻译"
      case "content-zh":
        return "正文翻译"
      case "summary-en":
        return "英文摘要"
      case "summary-zh":
        return "中文摘要"
      case "tags":
      default:
        return "处理标签"
    }
  }

  switch (target) {
    case "fetch-source":
      return "Fetch source"
    case "extract-content":
      return "Extract content"
    case "classify-relevance":
      return "Classify relevance"
    case "title-zh":
      return "Translate title"
    case "content-zh":
      return "Translate body"
    case "summary-en":
      return "English summary"
    case "summary-zh":
      return "Chinese summary"
    case "tags":
    default:
      return "Generate tags"
  }
}

function getRegenerationOptionDescription(
  target: ArticleRegenerationTarget,
  lang: "zh" | "en",
) {
  if (lang === "zh") {
    switch (target) {
      case "fetch-source":
        return "重新抓取并运行完整处理流水线，包括提取、翻译、摘要和标签。"
      case "extract-content":
        return "重新从来源抓取 HTML 并提取正文，不影响翻译和摘要。"
      case "classify-relevance":
        return "重新用模型判断文章是否与供应链安全相关。"
      case "title-zh":
        return "基于当前英文标题重新生成中文标题。"
      case "content-zh":
        return "基于当前英文正文重新生成中文正文。"
      case "summary-en":
        return "基于当前英文正文重新生成英文摘要。"
      case "summary-zh":
        return "基于当前中文正文重新生成中文摘要。"
      case "tags":
      default:
        return "基于当前英文正文重新生成安全标签。"
    }
  }

  switch (target) {
    case "fetch-source":
      return "Re-fetch from the source and run the full pipeline: extract, translate, summarize, and tag."
    case "extract-content":
      return "Re-fetch the HTML and extract the body. Does not affect translations or summaries."
    case "classify-relevance":
      return "Re-run the model to check if this article is relevant to supply-chain security."
    case "title-zh":
      return "Regenerate the Chinese title from the current English title."
    case "content-zh":
      return "Regenerate the Chinese body from the current English body."
    case "summary-en":
      return "Regenerate the English summary from the current English body."
    case "summary-zh":
      return "Regenerate the Chinese summary from the current Chinese body."
    case "tags":
    default:
      return "Regenerate security tags from the current English body."
  }
}

function mapDisabledReason(
  rawMessage: string | null,
  target: ArticleRegenerationTarget,
  lang: "zh" | "en",
) {
  if (!rawMessage) {
    return null
  }

  if (lang === "zh") {
    if (target === "classify-relevance") {
      return "需要先有英文标题和英文正文。"
    }
    if (target === "title-zh") {
      return "需要先有英文标题。"
    }

    if (target === "content-zh" || target === "summary-en" || target === "tags") {
      return "需要先有英文正文。"
    }

    return "需要先有中文正文。"
  }

  if (target === "classify-relevance") {
    return "An English title and English body are required first."
  }
  if (target === "title-zh") {
    return "An English title is required first."
  }

  if (target === "content-zh" || target === "summary-en" || target === "tags") {
    return "An English body is required first."
  }

  return "A Chinese body is required first."
}
