import { describe, expect, it } from "vitest";

import { parseFeedInput } from "../../apps/web/lib/feed-input";

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

describe("feed input parsing", () => {
  it("normalizes valid feed input", () => {
    const result = parseFeedInput(
      buildFormData({
        name: "SafeDep Blog",
        siteUrl: "https://safedep.io/blog",
        feedUrl: "https://safedep.io/rss.xml",
        feedType: "rss",
        pollIntervalMinutes: "15",
        enabled: "on",
      }),
    );

    expect(result).toEqual({
      name: "SafeDep Blog",
      siteUrl: "https://safedep.io/blog",
      feedUrl: "https://safedep.io/rss.xml",
      feedType: "rss",
      pollIntervalMinutes: 15,
      enabled: true,
    });
  });

  it("rejects invalid absolute URLs", () => {
    expect(() =>
      parseFeedInput(
        buildFormData({
          name: "SafeDep Blog",
          siteUrl: "/blog",
          feedUrl: "https://safedep.io/rss.xml",
        }),
      ),
    ).toThrow("站点地址 必须是完整的绝对地址。");
  });

  it("rejects unsupported URL protocols", () => {
    expect(() =>
      parseFeedInput(
        buildFormData({
          name: "Local File",
          siteUrl: "file:///tmp/site",
          feedUrl: "https://safedep.io/rss.xml",
        }),
      ),
    ).toThrow("站点地址 只支持 http 或 https 地址。");
  });

  it("rejects overlong names", () => {
    expect(() =>
      parseFeedInput(
        buildFormData({
          name: "a".repeat(121),
          siteUrl: "https://safedep.io/blog",
          feedUrl: "https://safedep.io/rss.xml",
        }),
      ),
    ).toThrow("来源名称不能超过 120 个字符。");
  });
});
