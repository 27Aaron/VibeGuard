import {
  getRegenerationRequirementError,
  type ArticleRegenerationTarget,
} from "./article-regeneration"

type RegenerationOptionArticle = {
  titleEn: string
  contentMdEn: string | null
  contentMdZh: string | null
}

export type ArticleRegenerationOption = {
  target: ArticleRegenerationTarget
  label: string
  disabled: boolean
  disabledReason: string | null
}

const REGENERATION_TARGET_ORDER: ArticleRegenerationTarget[] = [
  "full",
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
    if (target === "full") {
      return {
        target,
        label: lang === "zh" ? "全量重处理" : "Full reprocess",
        disabled: false,
        disabledReason: null,
      }
    }

    const disabledReason = getRegenerationRequirementError(
      {
        id: "preview",
        titleEn: article.titleEn,
        titleZh: null,
        summaryEn: null,
        summaryZh: null,
        contentMdEn: article.contentMdEn,
        contentMdZh: article.contentMdZh,
        tags: [],
        status: "ready",
        rawMeta: null,
      },
      target,
      lang,
    )

    return {
      target,
      label: getRegenerationOptionLabel(target, lang),
      disabled: Boolean(disabledReason),
      disabledReason: mapDisabledReason(disabledReason, target, lang),
    }
  })
}

function getRegenerationOptionLabel(
  target: Exclude<ArticleRegenerationTarget, "full">,
  lang: "zh" | "en",
) {
  if (lang === "zh") {
    switch (target) {
      case "title-zh":
        return "重生成中文标题"
      case "content-zh":
        return "重生成中文正文"
      case "summary-en":
        return "重生成英文摘要"
      case "summary-zh":
        return "重生成中文摘要"
      case "tags":
      default:
        return "重新生成标签"
    }
  }

  switch (target) {
    case "title-zh":
      return "Regenerate Chinese title"
    case "content-zh":
      return "Regenerate Chinese body"
    case "summary-en":
      return "Regenerate English summary"
    case "summary-zh":
      return "Regenerate Chinese summary"
    case "tags":
    default:
      return "Regenerate tags"
  }
}

function mapDisabledReason(
  rawMessage: string | null,
  target: Exclude<ArticleRegenerationTarget, "full">,
  lang: "zh" | "en",
) {
  if (!rawMessage) {
    return null
  }

  if (lang === "zh") {
    if (target === "title-zh") {
      return "需要先有英文标题。"
    }

    if (target === "content-zh" || target === "summary-en" || target === "tags") {
      return "需要先有英文正文。"
    }

    return "需要先有中文正文。"
  }

  if (target === "title-zh") {
    return "An English title is required first."
  }

  if (target === "content-zh" || target === "summary-en" || target === "tags") {
    return "An English body is required first."
  }

  return "A Chinese body is required first."
}
