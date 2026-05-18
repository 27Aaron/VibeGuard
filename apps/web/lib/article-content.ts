type LocalizedArticleInput = {
  titleEn: string
  titleZh?: string | null
  summaryEn?: string | null
  summaryZh?: string | null
  contentMdEn?: string | null
  contentMdZh?: string | null
}

export function pickArticleLocale(
  article: LocalizedArticleInput,
  requestedLocale: string | undefined,
) {
  const prefersZh = requestedLocale === "zh"
  const title = prefersZh
    ? article.titleZh || article.titleEn
    : article.titleEn || article.titleZh || ""
  const summary = prefersZh
    ? article.summaryZh || article.summaryEn || ""
    : article.summaryEn || article.summaryZh || ""
  const content = prefersZh
    ? article.contentMdZh || article.contentMdEn || ""
    : article.contentMdEn || article.contentMdZh || ""

  return {
    locale: prefersZh ? "zh" : "en",
    title,
    summary,
    content,
  }
}
