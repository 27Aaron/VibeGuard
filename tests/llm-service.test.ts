import { describe, expect, it, vi } from "vitest";

import {
  buildSummaryPrompt,
  buildTranslationPrompt,
} from "../packages/llm/src/prompts";
import { summarizeText } from "../packages/llm/src/summarize";
import { translateText } from "../packages/llm/src/translate";

describe("llm prompt builders", () => {
  it("should include source content in summary prompt", () => {
    const prompt = buildSummaryPrompt("Summarize it", "Hello world");

    expect(prompt).toContain("Summarize it");
    expect(prompt).toContain("Hello world");
    expect(prompt).toContain("--- SOURCE START ---");
  });

  it("should include source content in translation prompt", () => {
    const prompt = buildTranslationPrompt("Translate it", "Hello world");

    expect(prompt).toContain("Translate it");
    expect(prompt).toContain("Hello world");
    expect(prompt).toContain("--- SOURCE END ---");
    expect(prompt).toContain("Do not translate or rewrite fenced code blocks");
  });
});

describe("llm text services", () => {
  it("should send translation requests through the chat completions api", async () => {
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
          role: "user",
          content: expect.stringContaining("Hello world"),
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
              "翻译后的说明 __CF_CODE_BLOCK_0__ 保留，并且 `__CF_INLINE_CODE_0__` 也保留。",
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
          role: "user",
          content: expect.stringContaining("__CF_CODE_BLOCK_0__"),
        },
      ],
    });
    expect(create).toHaveBeenCalledWith({
      model: "gpt-5-mini",
      messages: [
        {
          role: "user",
          content: expect.not.stringContaining("const token = process.env.API_KEY"),
        },
      ],
    });
    expect(result).toContain("```js\nconst token = process.env.API_KEY;\n```");
    expect(result).toContain("`npm install`");
  });

  it("should send summary requests through the chat completions api", async () => {
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
          role: "user",
          content: expect.stringContaining("Hello world"),
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
