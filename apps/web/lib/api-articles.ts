import { and, desc, eq, ilike, or, sql } from "drizzle-orm"

import { articles, feeds, getDb } from "@vibeguard/db"
import {
  ARTICLE_ECOSYSTEM_VALUES,
  ARTICLE_RISK_CATEGORY_VALUES,
  type ArticleEcosystem,
  type ArticleRiskCategory,
  type ArticleStatus,
} from "@vibeguard/shared"

import { pickArticleLocale } from "./article-content"
import { resolveLang } from "./i18n"
import { formatDateTimeInShanghai, toShanghaiIsoOffset } from "./time"

const ALLOWED_STATUSES: ArticleStatus[] = [
  "pending",
  "processing",
  "ready",
  "failed",
  "filtered",
]
const ALLOWED_ECOSYSTEMS: ArticleEcosystem[] = [...ARTICLE_ECOSYSTEM_VALUES]
const ALLOWED_RISK_CATEGORIES: ArticleRiskCategory[] = [
  ...ARTICLE_RISK_CATEGORY_VALUES,
]

function clampLimit(raw: string | null) {
  const parsed = Number.parseInt(raw ?? "20", 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20
  }

  return Math.min(parsed, 100)
}

function clampPage(raw: string | null) {
  const parsed = Number.parseInt(raw ?? "1", 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }

  return Math.min(parsed, 10_000)
}

export function parseArticleListParams(searchParams: URLSearchParams) {
  const lang = resolveLang(searchParams.get("lang"))
  const statusParam = searchParams.get("status")?.trim()
  const status =
    statusParam && ALLOWED_STATUSES.includes(statusParam as ArticleStatus)
      ? (statusParam as ArticleStatus)
      : "ready"
  const source = searchParams.get("source")?.trim() ?? ""
  const query = searchParams.get("q")?.trim() ?? ""
  const ecosystemParam = searchParams.get("ecosystem")?.trim()
  const ecosystem =
    ecosystemParam &&
    ALLOWED_ECOSYSTEMS.includes(ecosystemParam as ArticleEcosystem)
      ? (ecosystemParam as ArticleEcosystem)
      : ""
  const riskCategoryParam = searchParams.get("riskCategory")?.trim()
  const riskCategory =
    riskCategoryParam &&
    ALLOWED_RISK_CATEGORIES.includes(riskCategoryParam as ArticleRiskCategory)
      ? (riskCategoryParam as ArticleRiskCategory)
      : ""
  const tag = searchParams.get("tag")?.trim().toLowerCase() ?? ""
  const limit = clampLimit(searchParams.get("limit"))
  const page = clampPage(searchParams.get("page"))

  return {
    lang,
    status,
    source,
    query,
    ecosystem,
    riskCategory,
    tag,
    limit,
    page,
  }
}

type BuildArticleListMetaInput = ReturnType<typeof parseArticleListParams> & {
  totalCount: number
  count: number
}

export function buildArticleListMeta(input: BuildArticleListMetaInput) {
  const totalPages = Math.max(1, Math.ceil(input.totalCount / input.limit))
  const page = Math.min(input.page, totalPages)

  return {
    lang: input.lang,
    status: input.status,
    source: input.source || null,
    query: input.query || null,
    ecosystem: input.ecosystem || null,
    riskCategory: input.riskCategory || null,
    tag: input.tag || null,
    limit: input.limit,
    count: input.count,
    page,
    pageSize: input.limit,
    totalCount: input.totalCount,
    totalPages,
  }
}

export async function listArticles(searchParams: URLSearchParams) {
  const db = getDb()
  const params = parseArticleListParams(searchParams)
  const filters = [
    eq(articles.status, params.status),
    params.source ? eq(feeds.name, params.source) : undefined,
    params.ecosystem ? eq(articles.ecosystem, params.ecosystem as ArticleEcosystem) : undefined,
    params.riskCategory ? eq(articles.riskCategory, params.riskCategory as ArticleRiskCategory) : undefined,
    // TODO: A GIN index on the `tags` column (using gin_toast_trgm or jsonb_path_ops)
    // would significantly speed up the `?` operator query below.
    // e.g. CREATE INDEX idx_articles_tags_gin ON articles USING gin (tags jsonb_path_ops);
    params.tag ? sql`${articles.tags} ? ${params.tag}` : undefined,
    // TODO: Leading `%` in ILIKE prevents B-tree index usage, causing full table scans.
    // Consider enabling the pg_trgm extension and creating a GIN trigram index:
    //   CREATE EXTENSION IF NOT EXISTS pg_trgm;
    //   CREATE INDEX idx_articles_title_en_trgm ON articles USING gin (title_en gin_trgm_ops);
    //   CREATE INDEX idx_articles_title_zh_trgm ON articles USING gin (title_zh gin_trgm_ops);
    // Then replace ILIKE with `%` wildcards with pg_trgm-powered queries for better performance.
    params.query
      ? or(
          ilike(articles.titleEn, `%${params.query}%`),
          ilike(articles.titleZh, `%${params.query}%`),
          ilike(articles.summaryEn, `%${params.query}%`),
          ilike(articles.summaryZh, `%${params.query}%`),
          ilike(feeds.name, `%${params.query}%`),
          sql`exists (
            select 1
            from jsonb_array_elements_text(${articles.tags}) as tag
            where tag ilike ${`%${params.query}%`}
          )`,
        )
      : undefined,
  ].filter(Boolean)
  const where = filters.length > 0 ? and(...filters) : undefined

  // Run count and data queries in parallel. The data query uses the raw page
  // offset; results are validated against the actual count after both resolve.
  const preliminaryOffset = (params.page - 1) * params.limit
  const [countRows, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .where(where),
    db
      .select({
        id: articles.id,
        titleEn: articles.titleEn,
        titleZh: articles.titleZh,
        summaryEn: articles.summaryEn,
        summaryZh: articles.summaryZh,
        contentMdEn: articles.contentMdEn,
        contentMdZh: articles.contentMdZh,
        url: articles.url,
        sourceName: feeds.name,
        ecosystem: articles.ecosystem,
        riskCategory: articles.riskCategory,
        tags: articles.tags,
        status: articles.status,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .innerJoin(feeds, eq(articles.feedId, feeds.id))
      .where(where)
      .orderBy(desc(articles.publishedAt))
      .limit(params.limit)
      .offset(preliminaryOffset),
  ])

  const totalCount = Number(countRows[0]?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / params.limit))
  const page = Math.min(params.page, totalPages)

  return {
    meta: buildArticleListMeta({
      ...params,
      page,
      totalCount,
      count: rows.length,
    }),
    items: rows.map((article) => {
      const localized = pickArticleLocale(article, params.lang)

      return {
        id: article.id,
        title: localized.title,
        summary: localized.summary,
        url: article.url,
        sourceName: article.sourceName,
        ecosystem: article.ecosystem,
        riskCategory: article.riskCategory,
        tags: article.tags,
        status: article.status,
        publishedAt:
          toShanghaiIsoOffset(article.publishedAt) ?? article.publishedAt.toISOString(),
        publishedAtDisplay: formatDateTimeInShanghai(article.publishedAt),
        updatedAt:
          toShanghaiIsoOffset(article.updatedAt) ?? article.updatedAt.toISOString(),
        updatedAtDisplay: formatDateTimeInShanghai(article.updatedAt),
        locale: localized.locale,
      }
    }),
  }
}

export async function getArticleById(articleId: string, requestedLocale: string | undefined, requiredStatus?: ArticleStatus) {
  const db = getDb()
  const rows = await db
    .select({
      id: articles.id,
      titleEn: articles.titleEn,
      titleZh: articles.titleZh,
      summaryEn: articles.summaryEn,
      summaryZh: articles.summaryZh,
      contentMdEn: articles.contentMdEn,
      contentMdZh: articles.contentMdZh,
      url: articles.url,
      canonicalUrl: articles.canonicalUrl,
      sourceName: feeds.name,
      ecosystem: articles.ecosystem,
      riskCategory: articles.riskCategory,
      tags: articles.tags,
      status: articles.status,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(requiredStatus ? and(eq(articles.id, articleId), eq(articles.status, requiredStatus)) : eq(articles.id, articleId))

  const article = rows[0]

  if (!article) {
    return null
  }

  const localized = pickArticleLocale(article, requestedLocale)

  return {
    id: article.id,
    title: localized.title,
    summary: localized.summary,
    content: localized.content,
    url: article.url,
    canonicalUrl: article.canonicalUrl,
    sourceName: article.sourceName,
    ecosystem: article.ecosystem,
    riskCategory: article.riskCategory,
    tags: article.tags,
    status: article.status,
    publishedAt:
      toShanghaiIsoOffset(article.publishedAt) ?? article.publishedAt.toISOString(),
    publishedAtDisplay: formatDateTimeInShanghai(article.publishedAt),
    updatedAt:
      toShanghaiIsoOffset(article.updatedAt) ?? article.updatedAt.toISOString(),
    updatedAtDisplay: formatDateTimeInShanghai(article.updatedAt),
    locale: localized.locale,
  }
}
