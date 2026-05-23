import { describe, expect, it, vi } from "vitest";

import {
  buildTranslationSystemPrompt,
  buildLocalizedSummaryPrompt,
} from "../../packages/llm/src/prompts";
import { summarizeText } from "../../packages/llm/src/summarize";
import { translateText } from "../../packages/llm/src/translate";

describe("llm prompt builders", () => {
  it("should include translation guardrail in system prompt", () => {
    const prompt = buildTranslationSystemPrompt("Translate it");

    expect(prompt).toContain("Translate it");
    expect(prompt).toContain("Do NOT translate or alter");
  });

  it("should include locale instruction in localized summary prompt (zh)", () => {
    const prompt = buildLocalizedSummaryPrompt("Summarize it", "zh");

    expect(prompt).toContain("Summarize it");
    expect(prompt).toContain("Simplified Chinese");
  });

  it("should include locale instruction in localized summary prompt (en)", () => {
    const prompt = buildLocalizedSummaryPrompt("Summarize it", "en");

    expect(prompt).toContain("Summarize it");
    expect(prompt).toContain("English");
  });
});

describe("llm text services", () => {
  it("should send translation requests with system/user separation", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "你好，世界",
          },
        },
      ],
    });

    const result = await translateText({
      client: {
        chat: { completions: { create } },
      },
      model: "gpt-5-mini",
      systemPrompt: "Translate to Chinese",
      sourceText: "Hello world",
    });

    expect(create).toHaveBeenCalledWith({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: expect.stringContaining("Translate to Chinese"),
        },
        {
          role: "user",
          content: "Hello world",
        },
      ],
    });
    expect(result).toBe("你好，世界");
  });

  it("should retry transient translation request failures", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary upstream error"))
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "你好，世界",
            },
          },
        ],
      });

    const result = await translateText({
      client: {
        chat: { completions: { create } },
      },
      model: "gpt-5-mini",
      systemPrompt: "Translate to Chinese",
      sourceText: "Hello world",
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toBe("你好，世界");
  });

  it("should preserve fenced and inline code when translating markdown", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "翻译后的说明 __CF_CODE_BLOCK_0__ 保留，并且 __CF_INLINE_CODE_0__ 也保留。",
          },
        },
      ],
    });

    const result = await translateText({
      client: {
        chat: { completions: { create } },
      },
      model: "gpt-5-mini",
      systemPrompt: "Translate to Chinese",
      sourceText:
        "Intro text.\n\n```js\nconst token = process.env.API_KEY;\n```\n\nUse `npm install` first.",
    });

    expect(create).toHaveBeenCalledWith({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: expect.stringContaining("Translate to Chinese"),
        },
        {
          role: "user",
          content: expect.stringContaining("__CF_CODE_BLOCK_0__"),
        },
      ],
    });
    expect(result).toContain("```js\nconst token = process.env.API_KEY;\n```");
    expect(result).toContain("`npm install`");
  });

  it("should send summary requests with system/user separation", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "A short summary.",
          },
        },
      ],
    });

    const result = await summarizeText({
      client: {
        chat: { completions: { create } },
      },
      model: "gpt-5-mini",
      systemPrompt: "Summarize in one sentence",
      sourceText: "Hello world",
    });

    expect(create).toHaveBeenCalledWith({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "Summarize in one sentence",
        },
        {
          role: "user",
          content: "Hello world",
        },
      ],
    });
    expect(result).toBe("A short summary.");
  });

  it("should retry transient summary request failures", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary upstream error"))
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "A short summary.",
            },
          },
        ],
      });

    const result = await summarizeText({
      client: {
        chat: { completions: { create } },
      },
      model: "gpt-5-mini",
      systemPrompt: "Summarize in one sentence",
      sourceText: "Hello world",
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toBe("A short summary.");
  });
});
