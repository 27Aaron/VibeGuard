import { stripMarkdown } from "./strip-markdown"
import { toRfc822InShanghai } from "./time"

type RssArticle = {
  id: string
  title: string
  summary: string | null
  sourceName: string
  publishedAt: string
  updatedAt: string
  url: string
  locale: string
}

type BuildRssFeedXmlInput = {
  title: string
  description: string
  siteUrl: string
  feedUrl: string
  language: string
  articles: RssArticle[]
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function buildRssFeedXml(input: BuildRssFeedXmlInput) {
  const lastBuildDate = toRfc822InShanghai(new Date())

  const siteUrl = input.siteUrl.replace(/\/+$/, "")

  const items = input.articles
    .map((article) => {
      const itemUrl = `${siteUrl}/${article.locale}/articles/${article.id}`
      const plainSummary = article.summary
        ? stripMarkdown(article.summary).replace(/\n+/g, " ")
        : ""

      return [
        "    <item>",
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(itemUrl)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(article.id)}</guid>`,
        `      <pubDate>${escapeXml(toRfc822InShanghai(article.publishedAt))}</pubDate>`,
        `      <author>${escapeXml(article.sourceName)}</author>`,
        `      <description>${escapeXml(plainSummary)}</description>`,
        "    </item>",
      ].join("\n")
    })
    .join("\n\n")

  const channel = [
    "  <channel>",
    `    <title>${escapeXml(input.title)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(input.description)}</description>`,
    `    <language>${escapeXml(input.language)}</language>`,
    `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    "    <ttl>60</ttl>",
    "    <managingEditor>noreply@vibeguard.dev (VibeGuard)</managingEditor>",
    "    <image>",
    `      <url>${escapeXml(siteUrl)}/favicon.ico</url>`,
    `      <title>${escapeXml(input.title)}</title>`,
    `      <link>${escapeXml(siteUrl)}</link>`,
    "    </image>",
    `    <atom:link href="${escapeXml(input.feedUrl)}" rel="self" type="application/rss+xml" />`,
    items,
    "  </channel>",
  ].join("\n")

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    channel,
    "</rss>",
    "",
  ].join("\n")
}
