import { describe, expect, it } from "vitest"

import { buildRssFeedXml } from "../../apps/web/lib/rss"

describe("rss feed builder", () => {
  it("renders a valid RSS channel with escaped content", () => {
    const xml = buildRssFeedXml({
      title: "VibeGuard Feed",
      description: "Security <feed> & updates",
      siteUrl: "http://127.0.0.1:3000",
      feedUrl: "http://127.0.0.1:3000/zh/feed.xml",
      language: "zh",
      articles: [
        {
          id: "article-1",
          title: 'Malicious <package> & campaign',
          summary: "Summary with <xml> chars & details.",
          sourceName: "SafeDep",
          publishedAt: "2026-05-19T08:00:00.000Z",
          updatedAt: "2026-05-19T09:00:00.000Z",
          url: "https://example.com/post",
          locale: "zh",
        },
      ],
    })

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain("<rss version=\"2.0\"")
    expect(xml).toContain("xmlns:atom=")
    expect(xml).toContain("Security &lt;feed&gt; &amp; updates")
    expect(xml).toContain("Malicious &lt;package&gt; &amp; campaign")
    expect(xml).toContain("http://127.0.0.1:3000/zh/articles/article-1")
    expect(xml).toContain("<author>SafeDep</author>")
    expect(xml).toContain("<ttl>60</ttl>")
    expect(xml).not.toContain("<category>")
  })

  it("handles empty article lists", () => {
    const xml = buildRssFeedXml({
      title: "Empty Feed",
      description: "No items yet",
      siteUrl: "http://127.0.0.1:3000",
      feedUrl: "http://127.0.0.1:3000/feed.xml",
      language: "en",
      articles: [],
    })

    expect(xml).toContain("<channel>")
    expect(xml).not.toContain("<item>")
  })

  it("formats RSS dates with the Shanghai clock and +0800 offset", () => {
    const xml = buildRssFeedXml({
      title: "Date Feed",
      description: "Date check",
      siteUrl: "http://127.0.0.1:3000",
      feedUrl: "http://127.0.0.1:3000/feed.xml",
      language: "zh",
      articles: [
        {
          id: "article-1",
          title: "Date check",
          summary: null,
          sourceName: "SafeDep",
          publishedAt: "2026-05-19T12:00:00.000Z",
          updatedAt: "2026-05-19T13:00:00.000Z",
          url: "https://example.com/post",
          locale: "zh",
        },
      ],
    })

    expect(xml).toContain("<pubDate>Tue, 19 May 2026 20:00:00 +0800</pubDate>")
    expect(xml).toMatch(/<lastBuildDate>\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} \+0800<\/lastBuildDate>/)
  })
})
