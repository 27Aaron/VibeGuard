import { describe, expect, it, vi } from "vitest"

import { ArticleStatus } from "@content-foundation/shared"

import {
  getRegenerationRequirementError,
  regenerateArticleTarget,
} from "../apps/web/lib/article-regeneration"

const baseArticle = {
  id: "article-1",
  titleEn: "English title",
  titleZh: "中文标题",
  summaryEn: "English summary",
  summaryZh: "中文摘要",
  contentMdEn: "English body",
  contentMdZh: "中文正文",
  tags: [],
  status: ArticleStatus.FAILED,
  rawMeta: null,
}

const activeSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKeyEncrypted: "ciphertext",
  model: "gpt-5-mini",
  translateTitlePrompt: "Translate title",
  translateContentPrompt: "Translate body",
  summaryPromptEn: "Summarize in English",
  summaryPromptZh: "用中文总结",
  tagPrompt: "Extract tags from {{content}}",
}

describe("getRegenerationRequirementError", () => {
  it("returns a localized requirement error for missing Chinese summary prerequisites", () => {
    expect(
      getRegenerationRequirementError(
        {
          ...baseArticle,
          contentMdZh: null,
        },
        "summary-zh",
        "zh",
      ),
    ).toBe("当前文章缺少中文正文，请先重新生成中文正文。")

    expect(
      getRegenerationRequirementError(
        {
          ...baseArticle,
          contentMdZh: null,
        },
        "summary-zh",
        "en",
      ),
    ).toBe("The article has no Chinese body yet. Regenerate the Chinese body first.")
  })
})

describe("regenerateArticleTarget", () => {
  it("regenerates the Chinese title only", async () => {
    const translateText = vi.fn().mockResolvedValue("新的中文标题")

    const result = await regenerateArticleTarget(
      {
        article: {
          ...baseArticle,
          titleZh: null,
          summaryEn: null,
          summaryZh: null,
          contentMdZh: null,
        },
        settings: activeSettings,
        target: "title-zh",
      },
      {
        createOpenAIClient: vi.fn().mockReturnValue({}),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText,
        summarizeText: vi.fn(),
      },
    )

    expect(translateText).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: "English title",
        systemPrompt: "Translate title",
      }),
    )
    expect(result).toEqual({
      patch: {
        titleZh: "新的中文标题",
      },
      nextStatus: ArticleStatus.FAILED,
    })
  })

  it("regenerates the English summary from the English body and can restore ready status", async () => {
    const summarizeText = vi.fn().mockResolvedValue("Fresh English summary")

    const result = await regenerateArticleTarget(
      {
        article: {
          ...baseArticle,
          summaryEn: null,
          status: ArticleStatus.FAILED,
        },
        settings: activeSettings,
        target: "summary-en",
      },
      {
        createOpenAIClient: vi.fn().mockReturnValue({}),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText: vi.fn(),
        summarizeText,
      },
    )

    expect(summarizeText).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: "English body",
      }),
    )
    expect(result).toEqual({
      patch: {
        summaryEn: "Fresh English summary",
      },
      nextStatus: ArticleStatus.READY,
    })
  })

  it("regenerates tags from the original English body", async () => {
    const generateTags = vi.fn().mockResolvedValue(["npm", "creds", "postinstall"])

    const result = await regenerateArticleTarget(
      {
        article: baseArticle,
        settings: activeSettings,
        target: "tags",
      },
      {
        createOpenAIClient: vi.fn().mockReturnValue({}),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText: vi.fn(),
        summarizeText: vi.fn(),
        generateTags,
      },
    )

    expect(generateTags).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: "English body",
        systemPrompt: "Extract tags from {{content}}",
      }),
    )
    expect(generateTags.mock.calls[0]?.[0]?.sourceText).not.toContain("中文正文")
    expect(result).toEqual({
      patch: {
        tags: ["npm", "creds", "postinstall"],
      },
      nextStatus: ArticleStatus.READY,
    })
  })
})
