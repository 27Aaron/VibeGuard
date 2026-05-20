import { NextRequest, NextResponse } from "next/server"

import { getPublicArticleFeed } from "@/lib/public-data"
import { buildRssFeedXml } from "@/lib/rss"

export const dynamic = "force-dynamic"

const SUPPORTED_LANGS = new Set(["zh-cn", "en-us"])

function buildFeedTitle(lang: string, source: string | null) {
  if (source) {
    return lang === "zh-cn"
      ? `VibeGuard 中文订阅 - ${source}`
      : `VibeGuard English Feed - ${source}`
  }

  return lang === "zh-cn" ? "VibeGuard 中文订阅" : "VibeGuard English Feed"
}

function buildFeedDescription(lang: string, source: string | null) {
  const localeText =
    lang === "zh-cn"
      ? "聚合后的供应链攻击与漏洞情报订阅流。"
      : "Aggregated supply-chain attack and vulnerability intelligence feed."

  if (source) {
    return lang === "zh-cn"
      ? `${localeText} 当前来源：${source}。`
      : `${localeText} Source filter: ${source}.`
  }

  return localeText
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang: rawLang } = await params
  const lang = SUPPORTED_LANGS.has(rawLang) ? rawLang : "zh-cn"
  const i18nLang = lang === "zh-cn" ? "zh" : "en"

  const searchParams = new URLSearchParams(request.nextUrl.searchParams)
  searchParams.set("status", searchParams.get("status") ?? "ready")
  searchParams.set("lang", i18nLang)
  searchParams.set("limit", searchParams.get("limit") ?? "20")

  const feed = await getPublicArticleFeed(searchParams)
  const source = feed.meta.source
  const origin = request.nextUrl.origin
  const feedUrl = `${origin}/${lang}/feed.xml`

  const xml = buildRssFeedXml({
    title: buildFeedTitle(lang, source),
    description: buildFeedDescription(lang, source),
    siteUrl: origin,
    feedUrl,
    language: lang,
    articles: feed.items,
  })

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  })
}
