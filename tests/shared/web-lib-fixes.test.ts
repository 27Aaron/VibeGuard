import { afterEach, describe, expect, it } from "vitest";

import {
  clearLoginFailures,
  isLoginRateLimited,
  recordFailedLogin,
  verifyAdminPassword,
} from "../../apps/web/lib/admin-auth";
import { normalizeUserFacingError } from "../../apps/web/lib/errors";
import { parseFeedInput } from "../../apps/web/lib/feed-input";
import { formatDateTimeInShanghai } from "../../apps/web/lib/time";

// errors.ts 生产环境回退隐藏原始错误信息
describe("normalizeUserFacingError hides raw messages in production", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns raw error.message in development", () => {
    process.env.NODE_ENV = "development";
    const result = normalizeUserFacingError(
      new Error("Some unexpected internal error"),
    );
    expect(result).toBe("Some unexpected internal error");
  });

  it("returns generic fallback in production", () => {
    process.env.NODE_ENV = "production";
    const result = normalizeUserFacingError(
      new Error("Some unexpected internal error"),
    );
    expect(result).toBe("操作失败，请稍后重试。");
  });

  it("returns generic English fallback in production with lang=en", () => {
    process.env.NODE_ENV = "production";
    const result = normalizeUserFacingError(
      new Error("Some unexpected internal error"),
      "en",
    );
    expect(result).toBe("The operation failed. Please try again.");
  });

  it("still matches known patterns in production", () => {
    process.env.NODE_ENV = "production";
    const result = normalizeUserFacingError(
      new Error("No active LLM settings found"),
    );
    expect(result).toContain("生效中的模型配置");
  });
});

// feed-input.ts 轮询间隔上限
describe("coercePollInterval enforces upper bound", () => {
  function buildFormData(values: Record<string, string>) {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      formData.set(key, value);
    });
    return formData;
  }

  it("clamps poll interval to 1440 minutes (24h)", () => {
    const result = parseFeedInput(
      buildFormData({
        name: "Test Feed",
        siteUrl: "https://example.com",
        feedUrl: "https://example.com/feed.xml",
        feedType: "rss",
        pollIntervalMinutes: "9999",
        enabled: "on",
      }),
    );
    expect(result.pollIntervalMinutes).toBe(1440);
  });

  it("allows poll intervals within the valid range", () => {
    const result = parseFeedInput(
      buildFormData({
        name: "Test Feed",
        siteUrl: "https://example.com",
        feedUrl: "https://example.com/feed.xml",
        feedType: "rss",
        pollIntervalMinutes: "60",
        enabled: "on",
      }),
    );
    expect(result.pollIntervalMinutes).toBe(60);
  });

  it("clamps exactly at the boundary (1440)", () => {
    const result = parseFeedInput(
      buildFormData({
        name: "Test Feed",
        siteUrl: "https://example.com",
        feedUrl: "https://example.com/feed.xml",
        feedType: "rss",
        pollIntervalMinutes: "1440",
        enabled: "on",
      }),
    );
    expect(result.pollIntervalMinutes).toBe(1440);
  });

  it("returns default for invalid values", () => {
    const result = parseFeedInput(
      buildFormData({
        name: "Test Feed",
        siteUrl: "https://example.com",
        feedUrl: "https://example.com/feed.xml",
        feedType: "rss",
        pollIntervalMinutes: "0",
        enabled: "on",
      }),
    );
    expect(result.pollIntervalMinutes).toBe(30);
  });
});

// time.ts 缓存 DateTimeFormat 实例
describe("formatDateTimeInShanghai uses cached formatter", () => {
  it("formats dates consistently", () => {
    const date = new Date("2025-01-15T08:30:00Z");
    const result = formatDateTimeInShanghai(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("handles null input", () => {
    expect(formatDateTimeInShanghai(null)).toBe("待处理");
    expect(formatDateTimeInShanghai(null, { lang: "en" })).toBe("Pending");
  });

  it("formats the same date identically on repeated calls", () => {
    const date = new Date("2025-06-15T12:00:00Z");
    const result1 = formatDateTimeInShanghai(date);
    const result2 = formatDateTimeInShanghai(date);
    expect(result1).toBe(result2);
  });
});

// constantTimeEqual 长度安全比较
describe("constantTimeEqual handles different-length inputs safely", () => {
  it("returns false for different-length strings", async () => {
    const result = await verifyAdminPassword(
      "short",
      "a-much-longer-password-value",
    );
    expect(result).toBe(false);
  });

  it("returns true for matching strings", async () => {
    const result = await verifyAdminPassword("test-password", "test-password");
    expect(result).toBe(true);
  });

  it("returns false for non-matching same-length strings", async () => {
    const result = await verifyAdminPassword("password-a", "password-b");
    expect(result).toBe(false);
  });
});

// admin-auth 限流在文档变更后仍然有效
describe("login rate limiting still functions", () => {
  afterEach(() => {
    clearLoginFailures("test-key-w05");
  });

  it("rate limits after max failures", () => {
    const key = "test-key-w05";
    const baseTime = 1_800_000_000_000;

    for (let i = 0; i < 5; i++) {
      recordFailedLogin(key, baseTime + i);
    }

    expect(isLoginRateLimited(key, baseTime + 10_000)).toBe(true);
    expect(isLoginRateLimited(key, baseTime + 400_000)).toBe(false);
  });
});
