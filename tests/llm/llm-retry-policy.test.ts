import { describe, expect, it } from "vitest";

import {
  DEFAULT_LLM_RETRY_CONFIG,
  formatLlmErrorMessage,
  getLlmErrorCode,
  isRetryableLlmError,
  normalizeLlmError,
  parseRetryAfterMs,
  resolveLlmRetryConfig,
  resolveRetryDelayMs,
} from "../../packages/llm/src/retry-policy";

function httpError(status: number, message = `HTTP ${status}`) {
  return Object.assign(new Error(message), { status });
}

describe("parseRetryAfterMs", () => {
  it("parses retry-after-ms first", () => {
    const headers = new Headers({
      "retry-after-ms": "1250",
      "retry-after": "9",
    });

    expect(parseRetryAfterMs(headers, Date.now())).toBe(1250);
  });

  it("parses numeric retry-after seconds", () => {
    expect(parseRetryAfterMs({ "retry-after": "2.5" }, Date.now())).toBe(2500);
  });

  it("parses HTTP-date retry-after", () => {
    const now = Date.parse("2026-05-24T10:00:00Z");
    const headers = {
      "retry-after": "Sun, 24 May 2026 10:00:03 GMT",
    };

    expect(parseRetryAfterMs(headers, now)).toBe(3000);
  });

  it("returns undefined for invalid or past retry-after values", () => {
    const now = Date.parse("2026-05-24T10:00:00Z");

    expect(parseRetryAfterMs({ "retry-after": "never" }, now)).toBeUndefined();
    expect(
      parseRetryAfterMs(
        { "retry-after": "Sun, 24 May 2026 09:59:59 GMT" },
        now,
      ),
    ).toBeUndefined();
  });
});

describe("resolveRetryDelayMs", () => {
  it("uses bounded retry-after before computed backoff", () => {
    const delay = resolveRetryDelayMs({
      attempt: 2,
      baseMs: 500,
      maxMs: 8000,
      retryAfterMs: 3000,
      random: () => 0,
    });

    expect(delay).toBe(3000);
  });

  it("clamps excessive retry-after values", () => {
    const delay = resolveRetryDelayMs({
      attempt: 2,
      baseMs: 500,
      maxMs: 8000,
      retryAfterMs: 60_000,
      random: () => 0,
    });

    expect(delay).toBe(8000);
  });

  it("applies capped exponential jitter", () => {
    const low = resolveRetryDelayMs({
      attempt: 3,
      baseMs: 500,
      maxMs: 8000,
      random: () => 0,
    });
    const high = resolveRetryDelayMs({
      attempt: 3,
      baseMs: 500,
      maxMs: 8000,
      random: () => 1,
    });

    expect(low).toBe(1500);
    expect(high).toBe(2500);
  });
});

describe("LLM error classification", () => {
  it("classifies retryable provider errors", () => {
    expect(getLlmErrorCode(httpError(429))).toBe("rate_limited");
    expect(getLlmErrorCode(httpError(503))).toBe("server_error");
    expect(isRetryableLlmError(httpError(408))).toBe(true);
    expect(isRetryableLlmError(httpError(409))).toBe(true);
    expect(isRetryableLlmError(httpError(500))).toBe(true);
  });

  it("classifies non-retryable provider errors", () => {
    expect(getLlmErrorCode(httpError(401))).toBe("non_retryable");
    expect(getLlmErrorCode(httpError(404))).toBe("non_retryable");
    expect(isRetryableLlmError(httpError(401))).toBe(false);
    expect(isRetryableLlmError(httpError(404))).toBe(false);
  });

  it("classifies timeout and network-like errors", () => {
    const timeout = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });
    const network = new Error("fetch failed");

    expect(getLlmErrorCode(timeout)).toBe("timeout");
    expect(getLlmErrorCode(network)).toBe("network_error");
    expect(isRetryableLlmError(timeout)).toBe(true);
    expect(isRetryableLlmError(network)).toBe(true);
  });

  it("formats and wraps categorized messages", () => {
    const wrapped = normalizeLlmError(httpError(429, "too many requests"));

    expect(wrapped.code).toBe("rate_limited");
    expect(wrapped.retryable).toBe(true);
    expect(wrapped.message).toBe("rate_limited: too many requests");
    expect(formatLlmErrorMessage(httpError(401, "bad key"))).toBe(
      "non_retryable: bad key",
    );
  });
});

describe("resolveLlmRetryConfig", () => {
  it("uses defaults when no environment overrides are present", () => {
    expect(resolveLlmRetryConfig({ env: {} })).toEqual(
      DEFAULT_LLM_RETRY_CONFIG,
    );
  });

  it("accepts explicit overrides before environment values", () => {
    expect(
      resolveLlmRetryConfig({
        env: {
          VIBEGUARD_LLM_TIMEOUT_MS: "90000",
          VIBEGUARD_LLM_MAX_ATTEMPTS: "5",
          VIBEGUARD_LLM_RETRY_BASE_MS: "1000",
          VIBEGUARD_LLM_RETRY_MAX_MS: "12000",
        },
        timeoutMs: 30_000,
        maxAttempts: 2,
      }),
    ).toEqual({
      timeoutMs: 30_000,
      maxAttempts: 2,
      retryBaseMs: 1000,
      retryMaxMs: 12_000,
    });
  });
});
