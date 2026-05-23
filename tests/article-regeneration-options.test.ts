import { describe, expect, it } from "vitest"

import { buildArticleRegenerationOptions } from "../apps/web/lib/article-regeneration-options"

describe("buildArticleRegenerationOptions", () => {
  it("returns localized labels and availability for Chinese admins", () => {
    const options = buildArticleRegenerationOptions(
      {
        url: "https://example.com/article",
        titleEn: "English title",
        contentMdEn: "",
        contentMdZh: null,
      },
      "zh",
    )

    expect(options).toEqual([
      expect.objectContaining({
        target: "fetch-source",
        label: "重抓原文",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "extract-content",
        label: "重提取正文",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "classify-relevance",
        label: "重判断相关性",
        disabled: true,
        disabledReason: "需要先有英文标题和英文正文。",
      }),
      expect.objectContaining({
        target: "title-zh",
        label: "重生成中文标题",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "content-zh",
        label: "重生成中文正文",
        disabled: true,
        disabledReason: "需要先有英文正文。",
      }),
      expect.objectContaining({
        target: "summary-en",
        label: "重生成英文摘要",
        disabled: true,
        disabledReason: "需要先有英文正文。",
      }),
      expect.objectContaining({
        target: "summary-zh",
        label: "重生成中文摘要",
        disabled: true,
        disabledReason: "需要先有中文正文。",
      }),
      expect.objectContaining({
        target: "tags",
        label: "重新生成标签",
        disabled: true,
        disabledReason: "需要先有英文正文。",
      }),
    ])
  })

  it("returns English copy for the English admin view", () => {
    const options = buildArticleRegenerationOptions(
      {
        url: "https://example.com/article",
        titleEn: "",
        contentMdEn: "English body",
        contentMdZh: "中文正文",
      },
      "en",
    )

    expect(options).toEqual([
      expect.objectContaining({
        target: "fetch-source",
        label: "Re-fetch source",
        disabled: false,
      }),
      expect.objectContaining({
        target: "extract-content",
        label: "Re-extract content",
        disabled: false,
      }),
      expect.objectContaining({
        target: "classify-relevance",
        label: "Re-classify relevance",
        disabled: true,
        disabledReason: "An English title and English body are required first.",
      }),
      expect.objectContaining({
        target: "title-zh",
        label: "Regenerate Chinese title",
        disabled: true,
        disabledReason: "An English title is required first.",
      }),
      expect.objectContaining({
        target: "content-zh",
        label: "Regenerate Chinese body",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "summary-en",
        label: "Regenerate English summary",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "summary-zh",
        label: "Regenerate Chinese summary",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "tags",
        label: "Regenerate tags",
        disabled: false,
        disabledReason: null,
      }),
    ])
  })

  it("enables classify-relevance when title and content are present", () => {
    const options = buildArticleRegenerationOptions(
      {
        url: "https://example.com/article",
        titleEn: "English title",
        contentMdEn: "English body",
        contentMdZh: null,
      },
      "zh",
    )

    const classifyOption = options.find((o) => o.target === "classify-relevance")
    expect(classifyOption).toEqual(
      expect.objectContaining({
        target: "classify-relevance",
        disabled: false,
        disabledReason: null,
      }),
    )
  })
})
