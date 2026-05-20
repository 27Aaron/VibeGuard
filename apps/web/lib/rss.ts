import { toRfc822InShanghai } from "./time"

function stripMarkdown(value: string): string {
  return (
    value
      // fenced code blocks
      .replace(/```[\s\S]*?```/g, "")
      // inline code
      .replace(/`([^`]+)`/g, "$1")
      // images
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      // links: [text](url) → text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // headings
      .replace(/^#{1,6}\s+/gm, "")
      // bold / italic
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/___([^_]+)___/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // strikethrough
      .replace(/~~([^~]+)~~/g, "$1")
      // blockquotes
      .replace(/^>\s+/gm, "")
      // unordered list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      // ordered list markers
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // HTML tags
      .replace(/<[^>]+>/g, "")
      // collapse whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}

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
  const lastBuildDate = input.articles[0]?.updatedAt
    ? toRfc822InShanghai(input.articles[0].updatedAt)
    : toRfc822InShanghai(new Date())

  const siteUrl = input.siteUrl.replace(/\/+$/, "")

  const items = input.articles
    .map((article) => {
      const itemUrl = `${siteUrl}/articles/${article.id}?lang=${article.locale}`
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
