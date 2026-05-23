import { describe, expect, it } from "vitest"

import { buildArticleRegenerationOptions } from "../../apps/web/lib/article-regeneration-options"

describe("buildArticleRegenerationOptions", () => {
  it("returns localized labels and availability for Chinese admins", () => {
    const options = buildArticleRegenerationOptions(
      {
        url: "https://example.com/article",
        titleEn: "English title",
        contentMdEn: "",
        status: "ready",
      },
      "zh",
    )

    expect(options).toEqual([
      expect.objectContaining({
        target: "fetch-source",
        label: "原文抓取",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "extract-content",
        label: "正文提取",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "classify-relevance",
        label: "相关性判断",
        disabled: true,
        disabledReason: "需要先有英文标题和英文正文。",
      }),
      expect.objectContaining({
        target: "skip-relevance",
        label: "跳过判断",
        disabled: true,
        disabledReason: "仅已过滤的文章可以跳过相关性判断。",
      }),
      expect.objectContaining({
        target: "title-zh",
        label: "标题翻译",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "content-zh",
        label: "正文翻译",
        disabled: true,
        disabledReason: "需要先有英文正文。",
      }),
      expect.objectContaining({
        target: "summary-en",
        label: "英文摘要",
        disabled: true,
        disabledReason: "需要先有英文正文。",
      }),
      expect.objectContaining({
        target: "summary-zh",
        label: "中文摘要",
        disabled: true,
        disabledReason: "需要先有英文正文。",
      }),
      expect.objectContaining({
        target: "tags",
        label: "处理标签",
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
        status: "ready",
      },
      "en",
    )

    expect(options).toEqual([
      expect.objectContaining({
        target: "fetch-source",
        label: "Fetch source",
        disabled: false,
      }),
      expect.objectContaining({
        target: "extract-content",
        label: "Extract content",
        disabled: false,
      }),
      expect.objectContaining({
        target: "classify-relevance",
        label: "Classify relevance",
        disabled: true,
        disabledReason: "An English title and English body are required first.",
      }),
      expect.objectContaining({
        target: "skip-relevance",
        label: "Skip filter",
        disabled: true,
        disabledReason: "Only filtered articles can skip the relevance check.",
      }),
      expect.objectContaining({
        target: "title-zh",
        label: "Translate title",
        disabled: true,
        disabledReason: "An English title is required first.",
      }),
      expect.objectContaining({
        target: "content-zh",
        label: "Translate body",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "summary-en",
        label: "English summary",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "summary-zh",
        label: "Chinese summary",
        disabled: false,
        disabledReason: null,
      }),
      expect.objectContaining({
        target: "tags",
        label: "Generate tags",
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
        status: "ready",
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

  it("disables translation, summary and tags targets for filtered articles", () => {
    const options = buildArticleRegenerationOptions(
      {
        url: "https://example.com/article",
        titleEn: "English title",
        contentMdEn: "English body",
        status: "filtered",
      },
      "zh",
    )

    expect(options).toEqual([
      expect.objectContaining({
        target: "fetch-source",
        disabled: false,
      }),
      expect.objectContaining({
        target: "extract-content",
        disabled: false,
      }),
      expect.objectContaining({
        target: "classify-relevance",
        disabled: false,
      }),
      expect.objectContaining({
        target: "skip-relevance",
        disabled: false,
      }),
      expect.objectContaining({
        target: "title-zh",
        disabled: true,
        disabledReason: "文章已被过滤，无法执行后续步骤。",
      }),
      expect.objectContaining({
        target: "content-zh",
        disabled: true,
        disabledReason: "文章已被过滤，无法执行后续步骤。",
      }),
      expect.objectContaining({
        target: "summary-en",
        disabled: true,
        disabledReason: "文章已被过滤，无法执行后续步骤。",
      }),
      expect.objectContaining({
        target: "summary-zh",
        disabled: true,
        disabledReason: "文章已被过滤，无法执行后续步骤。",
      }),
      expect.objectContaining({
        target: "tags",
        disabled: true,
        disabledReason: "文章已被过滤，无法执行后续步骤。",
      }),
    ])
  })
})
