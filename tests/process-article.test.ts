import { describe, expect, it, vi } from "vitest"

import { ArticleStatus, JobType } from "@vibeguard/shared"

import {
  buildSummaryPrompt,
  processArticleJob,
} from "../apps/worker/src/process-article"

function createRelevantChatClient() {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  relevant: true,
                  reason: "security content",
                }),
              },
            },
          ],
        }),
      },
    },
  }
}

function createIrrelevantChatClient() {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  relevant: false,
                  reason: "generic product update",
                }),
              },
            },
          ],
        }),
      },
    },
  }
}

describe("buildSummaryPrompt", () => {
  it("adds an explicit locale instruction", () => {
    expect(buildSummaryPrompt("Summarize the article.", "en")).toContain(
      "written in English",
    )
    expect(buildSummaryPrompt("Summarize the article.", "zh")).toContain(
      "written in Simplified Chinese",
    )
  })

  it("overrides conflicting language instructions in the base prompt", () => {
    expect(
      buildSummaryPrompt("Write the summary in Chinese.", "en"),
    ).toContain("ignore it and respond in English only")
    expect(
      buildSummaryPrompt("Write the summary in English.", "zh"),
    ).toContain("ignore it and respond in Simplified Chinese only")
  })
})

describe("processArticleJob", () => {
  it("extracts, translates, summarizes, and marks the article ready", async () => {
    const markArticleStatus = vi.fn().mockResolvedValue(undefined)
    const updateArticleContent = vi.fn().mockResolvedValue(undefined)
    const translateText = vi
      .fn()
      .mockResolvedValueOnce("中文标题")
      .mockResolvedValueOnce("中文正文")
    const summarizeText = vi
      .fn()
      .mockResolvedValueOnce("English summary")
      .mockResolvedValueOnce("中文摘要")

    await processArticleJob(
      { articleId: "article-1" },
      {
        loadArticle: vi.fn().mockResolvedValue({
          id: "article-1",
          url: "https://example.com/post",
          rawMeta: { seed: true },
        }),
        loadActiveLlmSettings: vi.fn().mockResolvedValue({
          apiKeyEncrypted: "ciphertext",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          translateTitlePrompt: "Translate title",
          translateContentPrompt: "Translate body",
          summaryPromptEn: "Summarize body in English",
          summaryPromptZh: "用中文总结正文",
        }),
        markArticleStatus,
        updateArticleContent,
        fetchArticleHtml: vi.fn().mockResolvedValue("<html></html>"),
        extractMarkdownFromHtml: vi.fn().mockResolvedValue({
          title: "English title",
          contentMd: "English body",
          author: "Author",
          description: "Description",
          publishedAt: "2026-05-19T00:00:00.000Z",
          siteName: "Example",
        }),
        createOpenAIClient: vi.fn().mockReturnValue(createRelevantChatClient()),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText,
        summarizeText,
      },
    )

    expect(markArticleStatus).toHaveBeenNthCalledWith(
      1,
      "article-1",
      ArticleStatus.PROCESSING,
    )
    expect(updateArticleContent).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({
        titleEn: "English title",
        titleZh: "中文标题",
        summaryEn: "English summary",
        summaryZh: "中文摘要",
        contentMdEn: "English body",
        contentMdZh: "中文正文",
      }),
    )
    expect(markArticleStatus).toHaveBeenNthCalledWith(
      2,
      "article-1",
      ArticleStatus.READY,
    )
  })

  it("stores LLM-generated tags from the original English body only", async () => {
    const updateArticleContent = vi.fn().mockResolvedValue(undefined)
    const translateText = vi
      .fn()
      .mockResolvedValueOnce("中文标题")
      .mockResolvedValueOnce("中文正文")
    const summarizeText = vi
      .fn()
      .mockResolvedValueOnce("English summary")
      .mockResolvedValueOnce("中文摘要")
    const generateTags = vi
      .fn()
      .mockResolvedValue(["npm", "creds", "postinstall"])

    await processArticleJob(
      { articleId: "article-1" },
      {
        loadArticle: vi.fn().mockResolvedValue({
          id: "article-1",
          url: "https://example.com/post",
          sourceName: "Example",
          rawMeta: { seed: true },
        }),
        loadActiveLlmSettings: vi.fn().mockResolvedValue({
          apiKeyEncrypted: "ciphertext",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          translateTitlePrompt: "Translate title",
          translateContentPrompt: "Translate body",
          summaryPromptEn: "Summarize body in English",
          summaryPromptZh: "用中文总结正文",
          tagPrompt: "Extract short tags from the original body: {{content}}",
        }),
        markArticleStatus: vi.fn().mockResolvedValue(undefined),
        updateArticleContent,
        fetchArticleHtml: vi.fn().mockResolvedValue("<html></html>"),
        extractMarkdownFromHtml: vi.fn().mockResolvedValue({
          title: "English title",
          contentMd: "Original English body mentioning npm postinstall token theft.",
          author: "Author",
          description: "Description",
          publishedAt: "2026-05-19T00:00:00.000Z",
          siteName: "Example",
        }),
        createOpenAIClient: vi.fn().mockReturnValue(createRelevantChatClient()),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText,
        summarizeText,
        generateTags,
      },
    )

    expect(generateTags).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "Extract short tags from the original body: {{content}}",
        sourceText: "Original English body mentioning npm postinstall token theft.",
      }),
    )
    expect(generateTags.mock.calls[0]?.[0]?.sourceText).not.toContain("中文正文")
    expect(updateArticleContent).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({
        tags: ["npm", "creds", "postinstall"],
      }),
    )
  })

  it("keeps irrelevant articles filtered instead of marking them ready", async () => {
    const markArticleStatus = vi.fn().mockResolvedValue(undefined)
    const updateArticleContent = vi.fn().mockResolvedValue(undefined)
    const updateArticlePatch = vi.fn().mockResolvedValue(undefined)
    const translateText = vi.fn()
    const summarizeText = vi.fn()

    await processArticleJob(
      { articleId: "article-1", jobType: JobType.EXTRACT },
      {
        loadArticle: vi.fn().mockResolvedValue({
          id: "article-1",
          url: "https://example.com/post",
          sourceName: "Example",
          rawMeta: { seed: true },
        }),
        loadActiveLlmSettings: vi.fn().mockResolvedValue({
          apiKeyEncrypted: "ciphertext",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          translateTitlePrompt: "Translate title",
          translateContentPrompt: "Translate body",
          summaryPromptEn: "Summarize body in English",
          summaryPromptZh: "用中文总结正文",
          relevancePrompt: "Classify relevance",
        }),
        markArticleStatus,
        updateArticleContent,
        updateArticlePatch,
        fetchArticleHtml: vi.fn().mockResolvedValue("<html></html>"),
        extractMarkdownFromHtml: vi.fn().mockResolvedValue({
          title: "Product launch",
          contentMd: "A general launch note with no security content.",
          author: "Author",
          description: "Description",
          publishedAt: "2026-05-19T00:00:00.000Z",
          siteName: "Example",
        }),
        createOpenAIClient: vi.fn().mockReturnValue(createIrrelevantChatClient()),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText,
        summarizeText,
      },
    )

    expect(translateText).not.toHaveBeenCalled()
    expect(summarizeText).not.toHaveBeenCalled()
    expect(updateArticleContent).not.toHaveBeenCalled()
    expect(updateArticlePatch).toHaveBeenLastCalledWith(
      "article-1",
      expect.objectContaining({
        rawMeta: expect.objectContaining({
          relevanceFilter: expect.objectContaining({
            reason: "generic product update",
          }),
        }),
      }),
    )
    expect(markArticleStatus).toHaveBeenLastCalledWith(
      "article-1",
      ArticleStatus.FILTERED,
    )
  })

  it("falls back to rule-based tags when LLM tag generation fails", async () => {
    const updateArticleContent = vi.fn().mockResolvedValue(undefined)
    const translateText = vi
      .fn()
      .mockResolvedValueOnce("中文标题")
      .mockResolvedValueOnce("中文正文")
    const summarizeText = vi
      .fn()
      .mockResolvedValueOnce("English summary")
      .mockResolvedValueOnce("中文摘要")

    await processArticleJob(
      { articleId: "article-1", jobType: JobType.EXTRACT },
      {
        loadArticle: vi.fn().mockResolvedValue({
          id: "article-1",
          url: "https://example.com/npm-backdoor",
          sourceName: "Example",
          rawMeta: { seed: true },
        }),
        loadActiveLlmSettings: vi.fn().mockResolvedValue({
          apiKeyEncrypted: "ciphertext",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          translateTitlePrompt: "Translate title",
          translateContentPrompt: "Translate body",
          summaryPromptEn: "Summarize body in English",
          summaryPromptZh: "用中文总结正文",
          tagPrompt: "Extract tags",
          relevancePrompt: "Classify relevance",
        }),
        markArticleStatus: vi.fn().mockResolvedValue(undefined),
        updateArticleContent,
        updateArticlePatch: vi.fn().mockResolvedValue(undefined),
        fetchArticleHtml: vi.fn().mockResolvedValue("<html></html>"),
        extractMarkdownFromHtml: vi.fn().mockResolvedValue({
          title: "NPM package backdoor steals tokens",
          contentMd: "A malicious npm package used a postinstall backdoor.",
          author: "Author",
          description: "A malicious npm package used a postinstall backdoor.",
          publishedAt: "2026-05-19T00:00:00.000Z",
          siteName: "Example",
        }),
        createOpenAIClient: vi.fn().mockReturnValue(createRelevantChatClient()),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText,
        summarizeText,
        generateTags: vi.fn().mockRejectedValue(new Error("tag model failed")),
      },
    )

    expect(updateArticleContent).toHaveBeenCalledWith(
      "article-1",
      expect.objectContaining({
        tags: expect.arrayContaining(["npm", "malicious-package", "malware"]),
      }),
    )
  })

  it("fails when the active credential cannot be decrypted", async () => {
    await expect(
      processArticleJob(
        { articleId: "article-1" },
        {
          loadArticle: vi.fn().mockResolvedValue({
            id: "article-1",
            url: "https://example.com/post",
            rawMeta: null,
          }),
          loadActiveLlmSettings: vi.fn().mockResolvedValue({
            apiKeyEncrypted: "ciphertext",
            baseUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          translateTitlePrompt: "Translate title",
          translateContentPrompt: "Translate body",
          summaryPromptEn: "Summarize body in English",
          summaryPromptZh: "用中文总结正文",
        }),
          markArticleStatus: vi.fn(),
          updateArticleContent: vi.fn(),
          fetchArticleHtml: vi.fn(),
          extractMarkdownFromHtml: vi.fn(),
          createOpenAIClient: vi.fn(),
          decryptSecret: vi.fn().mockReturnValue(""),
          translateText: vi.fn(),
          summarizeText: vi.fn(),
        },
      ),
    ).rejects.toThrow("Active LLM settings could not be decrypted.")
  })

  it("runs a summarize job without refetching or retranslating the article", async () => {
    const markArticleStatus = vi.fn().mockResolvedValue(undefined)
    const updateArticlePatch = vi.fn().mockResolvedValue(undefined)
    const summarizeText = vi
      .fn()
      .mockResolvedValueOnce("Fresh English summary")
      .mockResolvedValueOnce("新的中文摘要")
    const fetchArticleHtml = vi.fn()
    const extractMarkdownFromHtml = vi.fn()
    const translateText = vi.fn()

    await processArticleJob(
      { articleId: "article-1", jobType: JobType.SUMMARIZE },
      {
        loadArticle: vi.fn().mockResolvedValue({
          id: "article-1",
          url: "https://example.com/post",
          titleEn: "English title",
          titleZh: "中文标题",
          contentMdEn: "English body",
          contentMdZh: "中文正文",
          rawMeta: null,
        }),
        loadActiveLlmSettings: vi.fn().mockResolvedValue({
          apiKeyEncrypted: "ciphertext",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          translateTitlePrompt: "Translate title",
          translateContentPrompt: "Translate body",
          summaryPromptEn: "Summarize body in English",
          summaryPromptZh: "用中文总结正文",
        }),
        markArticleStatus,
        updateArticleContent: vi.fn(),
        updateArticlePatch,
        fetchArticleHtml,
        extractMarkdownFromHtml,
        createOpenAIClient: vi.fn().mockReturnValue({}),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText,
        summarizeText,
      },
    )

    expect(fetchArticleHtml).not.toHaveBeenCalled()
    expect(extractMarkdownFromHtml).not.toHaveBeenCalled()
    expect(translateText).not.toHaveBeenCalled()
    expect(updateArticlePatch).toHaveBeenCalledWith("article-1", {
      summaryEn: "Fresh English summary",
      summaryZh: "新的中文摘要",
    })
    expect(markArticleStatus).toHaveBeenLastCalledWith(
      "article-1",
      ArticleStatus.READY,
    )
  })

  it("resumes an extract job from persisted article fields", async () => {
    const fetchArticleHtml = vi.fn()
    const extractMarkdownFromHtml = vi.fn()
    const translateText = vi.fn()
    const summarizeText = vi.fn().mockResolvedValueOnce("新的中文摘要")
    const updateArticlePatch = vi.fn().mockResolvedValue(undefined)

    await processArticleJob(
      { articleId: "article-1", jobType: JobType.EXTRACT },
      {
        loadArticle: vi.fn().mockResolvedValue({
          id: "article-1",
          url: "https://example.com/post",
          sourceName: "Example",
          titleEn: "English title",
          titleZh: "中文标题",
          summaryEn: "English summary",
          summaryZh: null,
          contentMdEn: "English body",
          contentMdZh: "中文正文",
          ecosystem: "unknown",
          riskCategory: "unknown",
          tags: [],
          contentHash: "old-hash",
          rawMeta: { seed: true },
        }),
        loadActiveLlmSettings: vi.fn().mockResolvedValue({
          apiKeyEncrypted: "ciphertext",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          translateTitlePrompt: "Translate title",
          translateContentPrompt: "Translate body",
          summaryPromptEn: "Summarize body in English",
          summaryPromptZh: "用中文总结正文",
        }),
        markArticleStatus: vi.fn().mockResolvedValue(undefined),
        updateArticleContent: vi.fn().mockResolvedValue(undefined),
        updateArticlePatch,
        fetchArticleHtml,
        extractMarkdownFromHtml,
        createOpenAIClient: vi.fn().mockReturnValue({}),
        decryptSecret: vi.fn().mockReturnValue("sk-live"),
        translateText,
        summarizeText,
      },
    )

    expect(fetchArticleHtml).not.toHaveBeenCalled()
    expect(extractMarkdownFromHtml).not.toHaveBeenCalled()
    expect(translateText).not.toHaveBeenCalled()
    expect(summarizeText).toHaveBeenCalledTimes(1)
    expect(summarizeText).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: "中文正文",
      }),
    )
    expect(updateArticlePatch).toHaveBeenCalledWith("article-1", {
      summaryZh: "新的中文摘要",
    })
  })

  it("persists completed extract stages before later stages run", async () => {
    const updateArticlePatch = vi.fn().mockResolvedValue(undefined)
    const translateText = vi
      .fn()
      .mockResolvedValueOnce("中文标题")
      .mockRejectedValueOnce(new Error("content translation failed"))

    await expect(
      processArticleJob(
        { articleId: "article-1", jobType: JobType.EXTRACT },
        {
          loadArticle: vi.fn().mockResolvedValue({
            id: "article-1",
            url: "https://example.com/post",
            sourceName: "Example",
            titleEn: "Feed title",
            rawMeta: { seed: true },
          }),
          loadActiveLlmSettings: vi.fn().mockResolvedValue({
            apiKeyEncrypted: "ciphertext",
            baseUrl: "https://api.openai.com/v1",
            model: "gpt-5-mini",
            translateTitlePrompt: "Translate title",
            translateContentPrompt: "Translate body",
            summaryPromptEn: "Summarize body in English",
            summaryPromptZh: "用中文总结正文",
          }),
          markArticleStatus: vi.fn().mockResolvedValue(undefined),
          updateArticleContent: vi.fn().mockResolvedValue(undefined),
          updateArticlePatch,
          fetchArticleHtml: vi.fn().mockResolvedValue("<html></html>"),
          extractMarkdownFromHtml: vi.fn().mockResolvedValue({
            title: "English title",
            contentMd: "English body",
            author: "Author",
            description: "Description",
            publishedAt: "2026-05-19T00:00:00.000Z",
            siteName: "Example",
          }),
          createOpenAIClient: vi.fn().mockReturnValue(createRelevantChatClient()),
          decryptSecret: vi.fn().mockReturnValue("sk-live"),
          translateText,
          summarizeText: vi.fn(),
        },
      ),
    ).rejects.toThrow("content translation failed")

    expect(updateArticlePatch).toHaveBeenNthCalledWith(
      1,
      "article-1",
      expect.objectContaining({
        titleEn: "English title",
        contentMdEn: "English body",
      }),
    )
    expect(updateArticlePatch).toHaveBeenNthCalledWith(2, "article-1", {
      titleZh: "中文标题",
    })
  })
})
