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
  const lastBuildDate = input.articles[0]?.updatedAt
    ? toRfc822InShanghai(input.articles[0].updatedAt)
    : toRfc822InShanghai(new Date())

  const items = input.articles
    .map((article) => {
      const itemUrl = `${input.siteUrl.replace(/\/+$/, "")}/articles/${article.id}?lang=${article.locale}`
      const descriptionParts = [
        article.summary?.trim() || "",
        `Source: ${article.sourceName}`,
        `Original URL: ${article.url}`,
      ].filter(Boolean)

      return [
        "<item>",
        `<title>${escapeXml(article.title)}</title>`,
        `<link>${escapeXml(itemUrl)}</link>`,
        `<guid isPermaLink="false">${escapeXml(article.id)}</guid>`,
        `<pubDate>${escapeXml(toRfc822InShanghai(article.publishedAt))}</pubDate>`,
        `<description>${escapeXml(descriptionParts.join("\n\n"))}</description>`,
        `<category>${escapeXml(article.sourceName)}</category>`,
        "</item>",
      ].join("")
    })
    .join("")

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    `<title>${escapeXml(input.title)}</title>`,
    `<link>${escapeXml(input.siteUrl)}</link>`,
    `<description>${escapeXml(input.description)}</description>`,
    `<language>${escapeXml(input.language)}</language>`,
    `<lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    `<atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(input.feedUrl)}" rel="self" type="application/rss+xml" />`,
    items,
    "</channel>",
    "</rss>",
  ].join("")
}
