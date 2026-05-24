import { describe, expect, it } from "vitest";

import {
  createOpenAIClient,
  resolveOpenAIClientOptions,
} from "../../packages/llm/src/client";

describe("resolveOpenAIClientOptions", () => {
  it("disables SDK retries and applies the shared LLM timeout", () => {
    expect(
      resolveOpenAIClientOptions({
        baseUrl: "https://api.example.com/v1",
        apiKey: "secret",
        retryConfig: {
          timeoutMs: 45_000,
          maxAttempts: 4,
          retryBaseMs: 750,
          retryMaxMs: 10_000,
        },
      }),
    ).toEqual({
      baseURL: "https://api.example.com/v1",
      apiKey: "secret",
      timeout: 45_000,
      maxRetries: 0,
    });
  });

  it("allows callers to override SDK maxRetries explicitly", () => {
    expect(
      resolveOpenAIClientOptions({
        baseUrl: "https://api.example.com/v1",
        apiKey: "secret",
        maxRetries: 2,
        retryConfig: {
          timeoutMs: 30_000,
          maxAttempts: 3,
          retryBaseMs: 500,
          retryMaxMs: 8_000,
        },
      }).maxRetries,
    ).toBe(2);
  });
});

describe("createOpenAIClient", () => {
  it("constructs the SDK client with bounded retry options", () => {
    const client = createOpenAIClient({
      baseUrl: "https://api.example.com/v1",
      apiKey: "secret",
      retryConfig: {
        timeoutMs: 12_000,
        maxAttempts: 3,
        retryBaseMs: 500,
        retryMaxMs: 8_000,
      },
    });

    expect(client.baseURL).toBe("https://api.example.com/v1");
    expect(client.apiKey).toBe("secret");
    expect(client.timeout).toBe(12_000);
    expect(client.maxRetries).toBe(0);
  });
});
