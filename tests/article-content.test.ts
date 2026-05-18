import { describe, expect, it } from "vitest"

import { pickArticleLocale } from "../apps/web/lib/article-content"

describe("article content locale selection", () => {
  const article = {
    titleEn: "English title",
    titleZh: "中文标题",
    summaryEn: "English summary",
    summaryZh: "中文摘要",
    contentMdEn: "English content",
    contentMdZh: "中文正文",
  }

  it("prefers Chinese content when requested", () => {
    expect(pickArticleLocale(article, "zh")).toEqual({
      locale: "zh",
      title: "中文标题",
      summary: "中文摘要",
      content: "中文正文",
    })
  })

  it("falls back to English when localized fields are missing", () => {
    expect(
      pickArticleLocale(
        {
          titleEn: "English title",
          titleZh: null,
          summaryEn: "English summary",
          summaryZh: null,
          contentMdEn: "English content",
          contentMdZh: null,
        },
        "zh",
      ),
    ).toEqual({
      locale: "zh",
      title: "English title",
      summary: "English summary",
      content: "English content",
    })
  })
})
