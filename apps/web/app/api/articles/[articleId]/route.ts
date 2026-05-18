import { NextRequest, NextResponse } from "next/server"

import { getArticleById } from "@/lib/api-articles"
import { resolveLang } from "@/lib/i18n"

export const dynamic = "force-dynamic"

type ArticleRouteProps = {
  params: Promise<{
    articleId: string
  }>
}

export async function GET(request: NextRequest, { params }: ArticleRouteProps) {
  const { articleId } = await params
  const lang = resolveLang(request.nextUrl.searchParams.get("lang"))
  const article = await getArticleById(
    articleId,
    lang,
  )

  if (!article) {
    return NextResponse.json(
      {
        error: lang === "zh" ? "未找到对应文章。" : "Article not found.",
      },
      {
        status: 404,
      },
    )
  }

  return NextResponse.json(article)
}
