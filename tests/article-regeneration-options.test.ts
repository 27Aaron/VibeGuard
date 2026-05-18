import { describe, expect, it } from "vitest"

import { buildArticleRegenerationOptions } from "../apps/web/lib/article-regeneration-options"

describe("buildArticleRegenerationOptions", () => {
  it("returns localized labels and availability for Chinese admins", () => {
    const options = buildArticleRegenerationOptions(
      {
        titleEn: "English title",
        contentMdEn: "",
        contentMdZh: null,
      },
      "zh",
    )

    expect(options).toEqual([
      expect.objectContaining({
        target: "full",
        label: "全量重处理",
        disabled: false,
        disabledReason: null,
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
        titleEn: "",
        contentMdEn: "English body",
        contentMdZh: "中文正文",
      },
      "en",
    )

    expect(options).toEqual([
      expect.objectContaining({
        target: "full",
        label: "Full reprocess",
        disabled: false,
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
})
