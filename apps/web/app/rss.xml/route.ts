import { NextRequest, NextResponse } from "next/server"

import { getPublicArticleFeed } from "@/lib/public-data"
import { resolveLang } from "@/lib/i18n"
import { buildRssFeedXml } from "@/lib/rss"

export const dynamic = "force-dynamic"

function buildFeedTitle(lang: string, source: string | null) {
  if (source) {
    return lang === "zh"
      ? `VibeGuard 中文订阅 - ${source}`
      : `VibeGuard English Feed - ${source}`
  }

  return lang === "zh" ? "VibeGuard 中文订阅" : "VibeGuard English Feed"
}

function buildFeedDescription(lang: string, source: string | null) {
  const localeText =
    lang === "zh"
      ? "聚合后的供应链攻击与漏洞情报订阅流。"
      : "Aggregated supply-chain attack and vulnerability intelligence feed."

  if (source) {
    return lang === "zh"
      ? `${localeText} 当前来源：${source}。`
      : `${localeText} Source filter: ${source}.`
  }

  return localeText
}

export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.nextUrl.searchParams)

  if (!searchParams.get("status")) {
    searchParams.set("status", "ready")
  }

  searchParams.set("lang", resolveLang(searchParams.get("lang")))

  if (!searchParams.get("limit")) {
    searchParams.set("limit", "20")
  }

  const feed = await getPublicArticleFeed(searchParams)
  const lang = feed.meta.lang
  const source = feed.meta.source
  const origin = request.nextUrl.origin
  const feedUrl = request.nextUrl.toString()

  const xml = buildRssFeedXml({
    title: buildFeedTitle(lang, source),
    description: buildFeedDescription(lang, source),
    siteUrl: origin,
    feedUrl,
    language: lang === "zh" ? "zh-cn" : "en-us",
    articles: feed.items,
  })

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  })
}
