import { describe, expect, it, vi } from "vitest";

import { createChatCompletionTextWithRetry } from "../../packages/llm/src/chat";

const retryConfig = {
  timeoutMs: 30_000,
  maxAttempts: 3,
  retryBaseMs: 100,
  retryMaxMs: 5_000,
};

function completion(content: string) {
  return {
    choices: [
      {
        message: { content },
      },
    ],
  };
}

function httpError(status: number, message: string, headers?: Headers) {
  return Object.assign(new Error(message), { status, headers });
}

describe("createChatCompletionTextWithRetry", () => {
  it("respects provider Retry-After values for retryable errors", async () => {
    const waits: number[] = [];
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        httpError(429, "rate limited", new Headers({ "retry-after": "2" })),
      )
      .mockResolvedValueOnce(completion("ok"));

    const result = await createChatCompletionTextWithRetry({
      client: { chat: { completions: { create } } },
      model: "gpt-5-mini",
      systemPrompt: "System",
      userContent: "User",
      retryConfig,
      wait: async (ms) => {
        waits.push(ms);
      },
      random: () => 0.5,
    });

    expect(result.text).toBe("ok");
    expect(create).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([2_000]);
  });

  it("does not retry non-retryable provider errors", async () => {
    const wait = vi.fn(async () => {});
    const create = vi.fn().mockRejectedValue(httpError(401, "bad key"));

    await expect(
      createChatCompletionTextWithRetry({
        client: { chat: { completions: { create } } },
        model: "gpt-5-mini",
        userContent: "User",
        retryConfig,
        wait,
      }),
    ).rejects.toMatchObject({
      code: "non_retryable",
      retryable: false,
      message: "non_retryable: bad key",
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("throws a categorized error after retry attempts are exhausted", async () => {
    const waits: number[] = [];
    const create = vi.fn().mockRejectedValue(httpError(503, "overloaded"));

    await expect(
      createChatCompletionTextWithRetry({
        client: { chat: { completions: { create } } },
        model: "gpt-5-mini",
        userContent: "User",
        retryConfig: {
          ...retryConfig,
          maxAttempts: 2,
        },
        wait: async (ms) => {
          waits.push(ms);
        },
        random: () => 0.5,
      }),
    ).rejects.toMatchObject({
      code: "server_error",
      retryable: true,
      message: "server_error: overloaded",
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([100]);
  });
});
