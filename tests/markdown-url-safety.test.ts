import { describe, expect, it } from "vitest"

import {
  resolveMarkdownImageProxyUrl,
  resolveMarkdownLinkUrl,
} from "../apps/web/lib/markdown-url"

describe("markdown URL safety", () => {
  it("allows safe absolute and source-relative links", () => {
    expect(resolveMarkdownLinkUrl("https://example.com/post")).toBe(
      "https://example.com/post",
    )
    expect(
      resolveMarkdownLinkUrl("/docs/post", "https://example.com/blog/index.html"),
    ).toBe("https://example.com/docs/post")
    expect(resolveMarkdownLinkUrl("mailto:security@example.com")).toBe(
      "mailto:security@example.com",
    )
    expect(resolveMarkdownLinkUrl("#section")).toBe("#section")
  })

  it("neutralizes unsafe markdown link protocols", () => {
    expect(resolveMarkdownLinkUrl("javascript:alert(1)")).toBe("#")
    expect(resolveMarkdownLinkUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe("#")
  })

  it("only proxies http images", () => {
    expect(resolveMarkdownImageProxyUrl("https://example.com/image.png")).toBe(
      "/api/proxy?url=https%3A%2F%2Fexample.com%2Fimage.png",
    )
    expect(
      resolveMarkdownImageProxyUrl(
        "/image.png",
        "https://example.com/articles/post",
      ),
    ).toBe("/api/proxy?url=https%3A%2F%2Fexample.com%2Fimage.png")
    expect(resolveMarkdownImageProxyUrl("javascript:alert(1)")).toBe("")
  })
})
