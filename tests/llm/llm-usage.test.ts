import { describe, expect, it, vi } from "vitest";

import { createChatCompletionTextWithRetry } from "../../packages/llm/src/chat";
import { translateText } from "../../packages/llm/src/translate";
import { summarizeText } from "../../packages/llm/src/summarize";
import { classifyRelevance } from "../../packages/llm/src/relevance";
import { generateTags } from "../../packages/llm/src/tags";

describe("usage extraction from chat completion", () => {
  it("should return usage when the API response includes it", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Hello" } }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        prompt_tokens_details: { cached_tokens: 80 },
      },
    });

    const result = await createChatCompletionTextWithRetry({
      client: { chat: { completions: { create } } },
      model: "gpt-4o",
      systemPrompt: "You are helpful.",
      userContent: "Say hi",
    });

    expect(result.text).toBe("Hello");
    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cachedTokens: 80,
      finishReason: undefined,
    });
  });

  it("should return null usage when API response omits it", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Hi" } }],
    });

    const result = await createChatCompletionTextWithRetry({
      client: { chat: { completions: { create } } },
      model: "gpt-4o",
      userContent: "Say hi",
    });

    expect(result.text).toBe("Hi");
    expect(result.usage).toBeNull();
  });

  it("should extract finish_reason from choices", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Done" }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });

    const result = await createChatCompletionTextWithRetry({
      client: { chat: { completions: { create } } },
      model: "gpt-4o",
      userContent: "Go",
    });

    expect(result.usage?.finishReason).toBe("stop");
  });
});

describe("translateText returns usage", () => {
  it("should return translated text and usage from the API", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "你好" } }],
      usage: {
        prompt_tokens: 200,
        completion_tokens: 30,
        total_tokens: 230,
        prompt_tokens_details: { cached_tokens: 150 },
      },
    });

    const result = await translateText({
      client: { chat: { completions: { create } } },
      model: "gpt-4o",
      systemPrompt: "Translate to Chinese",
      sourceText: "Hello",
    });

    expect(result.result).toBe("你好");
    expect(result.usage).toEqual({
      promptTokens: 200,
      completionTokens: 30,
      totalTokens: 230,
      cachedTokens: 150,
      finishReason: undefined,
    });
  });
});

describe("summarizeText returns usage", () => {
  it("should return summary text and usage from the API", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "A summary." } }],
      usage: {
        prompt_tokens: 500,
        completion_tokens: 40,
        total_tokens: 540,
      },
    });

    const result = await summarizeText({
      client: { chat: { completions: { create } } },
      model: "gpt-4o",
      systemPrompt: "Summarize",
      sourceText: "Long article text here",
    });

    expect(result.result).toBe("A summary.");
    expect(result.usage).toEqual({
      promptTokens: 500,
      completionTokens: 40,
      totalTokens: 540,
      cachedTokens: undefined,
      finishReason: undefined,
    });
  });
});

describe("classifyRelevance returns usage", () => {
  it("should return relevance result and usage from the API", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              relevant: true,
              reason: "security content",
            }),
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 300,
        completion_tokens: 20,
        total_tokens: 320,
        prompt_tokens_details: { cached_tokens: 250 },
      },
    });

    const result = await classifyRelevance({
      client: { chat: { completions: { create } } },
      model: "gpt-4o",
      systemPrompt: "Classify relevance",
      sourceText: "Malicious npm package found",
    });

    expect(result.result).toEqual({
      relevant: true,
      reason: "security content",
    });
    expect(result.usage).toEqual({
      promptTokens: 300,
      completionTokens: 20,
      totalTokens: 320,
      cachedTokens: 250,
      finishReason: "stop",
    });
  });
});

describe("generateTags returns usage", () => {
  it("should return tags and usage from the API", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"tags":["npm","typosquat"]}' } }],
      usage: {
        prompt_tokens: 400,
        completion_tokens: 10,
        total_tokens: 410,
      },
    });

    const result = await generateTags({
      client: { chat: { completions: { create } } },
      model: "gpt-4o",
      systemPrompt: "Extract tags",
      sourceText: "Malicious npm package typosquatting",
    });

    expect(result.result).toEqual(["npm", "typosquat"]);
    expect(result.usage).toEqual({
      promptTokens: 400,
      completionTokens: 10,
      totalTokens: 410,
      cachedTokens: undefined,
      finishReason: undefined,
    });
  });
});
