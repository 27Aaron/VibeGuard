import { ArticleStatus } from "@vibeguard/shared"

import {
  getRegenerationRequirementError,
  type ArticleRegenerationTarget,
} from "./article-regeneration"

type RegenerationOptionArticle = {
  url: string
  titleEn: string
  contentMdEn: string | null
  status: ArticleStatus
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
  "skip-relevance",
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

    if (target === "skip-relevance") {
      const isFiltered = article.status === "filtered"
      return {
        target,
        label,
        description,
        disabled: !isFiltered,
        disabledReason: isFiltered
          ? null
          : lang === "zh"
            ? "仅已过滤的文章可以跳过相关性判断。"
            : "Only filtered articles can skip the relevance check.",
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
        contentMdZh: null,
        tags: [],
        status: article.status,
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
      case "skip-relevance":
        return "跳过判断"
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
    case "skip-relevance":
      return "Skip filter"
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
        return "重新抓取并运行完整流水线。"
      case "extract-content":
        return "重新从来源抓取并提取正文。"
      case "classify-relevance":
        return "重新判断文章是否与供应链安全相关。"
      case "skip-relevance":
        return "忽略过滤结果，清除标记并恢复文章。"
      case "title-zh":
        return "重新翻译英文标题为中文标题。"
      case "content-zh":
        return "重新翻译英文正文为中文正文。"
      case "summary-en":
        return "重新从英文正文生成英文摘要。"
      case "summary-zh":
        return "重新从英文正文生成中文摘要。"
      case "tags":
      default:
        return "重新从英文正文生成安全标签。"
    }
  }

  switch (target) {
    case "fetch-source":
      return "Re-fetch and run the full pipeline."
    case "extract-content":
      return "Re-fetch and extract the body from source."
    case "classify-relevance":
      return "Re-check if relevant to supply-chain security."
    case "skip-relevance":
      return "Dismiss the filter, clear the flag, and restore the article."
    case "title-zh":
      return "Re-translate the English title into Chinese."
    case "content-zh":
      return "Re-translate the English body into Chinese."
    case "summary-en":
      return "Re-generate English summary from the English body."
    case "summary-zh":
      return "Re-generate Chinese summary from the Chinese body."
    case "tags":
    default:
      return "Re-generate security tags from the English body."
  }
}

function mapDisabledReason(
  rawMessage: string | null,
  _target: ArticleRegenerationTarget,
  lang: "zh" | "en",
) {
  if (!rawMessage) {
    return null
  }

  if (rawMessage.includes("已被过滤") || rawMessage.includes("has been filtered")) {
    return lang === "zh" ? "文章已被过滤，无法执行后续步骤。" : "This article has been filtered."
  }

  if (lang === "zh") {
    if (_target === "classify-relevance" || _target === "skip-relevance") {
      return "需要先有英文标题和英文正文。"
    }
    if (_target === "title-zh") {
      return "需要先有英文标题。"
    }
    return "需要先有英文正文。"
  }

  if (_target === "classify-relevance" || _target === "skip-relevance") {
    return "An English title and English body are required first."
  }
  if (_target === "title-zh") {
    return "An English title is required first."
  }
  return "An English body is required first."
}
