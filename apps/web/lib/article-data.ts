import { desc, eq, sql } from "drizzle-orm"
import { articles, feeds, getDb } from "@vibeguard/db"
import {
  DEFAULT_ADMIN_ARTICLE_PAGE_SIZE,
  type AdminArticleListParams,
} from "./admin-article-pagination"
import { formatDateTimeInShanghai } from "./time"

function formatDateTime(value: Date | null | undefined, lang: "zh" | "en" = "zh", fallback?: string) {
  return formatDateTimeInShanghai(value, { lang, fallback })
}

export async function getArticleRows(input: Partial<AdminArticleListParams> = {}) {
  const db = getDb()
  const pageSize = input.pageSize ?? DEFAULT_ADMIN_ARTICLE_PAGE_SIZE
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1))
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
  const totalCount = Number(countRow?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const offset = (page - 1) * pageSize
  const rows = await db
    .select({
      id: articles.id,
      titleEn: articles.titleEn,
      titleZh: articles.titleZh,
      sourceName: feeds.name,
      status: articles.status,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .orderBy(desc(articles.publishedAt))
    .limit(pageSize)
    .offset(offset)

  return {
    rows: rows.map((article) => ({
      id: article.id,
      title: article.titleZh || article.titleEn,
      titleEn: article.titleEn,
      titleZh: article.titleZh,
      source: article.sourceName,
      status: article.status,
      publishedAt: formatDateTime(article.publishedAt),
      updatedAt: formatDateTime(article.updatedAt),
    })),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      from: totalCount === 0 ? 0 : offset + 1,
      to: offset + rows.length,
    },
  }
}

export async function getArticleDetail(articleId: string) {
  const db = getDb()
  const rows = await db
    .select()
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.id, articleId))

  const row = rows[0]
  if (!row) return null

  return { ...row.articles, sourceName: row.feeds.name }
}
