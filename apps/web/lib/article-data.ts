import { desc, eq, sql } from "drizzle-orm";
import { articles, feeds, getDb } from "@vibeguard/db";
import type { AppLang } from "./i18n";
import {
  DEFAULT_ADMIN_ARTICLE_PAGE_SIZE,
  type AdminArticleListParams,
} from "./admin-article-pagination";
import { stripMarkdown } from "./strip-markdown";
import { formatDateTimeInShanghai } from "./time";

function formatDateTime(
  value: Date | null | undefined,
  lang: "zh" | "en" = "zh",
  fallback?: string,
) {
  return formatDateTimeInShanghai(value, { lang, fallback });
}

function getArticleListTitle(
  article: { titleEn: string; titleZh: string | null },
  lang: AppLang,
) {
  return lang === "zh"
    ? article.titleZh || article.titleEn || "未命名文章"
    : article.titleEn || article.titleZh || "Untitled article";
}

export async function getArticleRows(
  input: Partial<AdminArticleListParams> & {
    lang?: AppLang;
    search?: string;
  } = {},
) {
  const db = getDb();
  const lang = input.lang ?? "zh";
  const pageSize = input.pageSize ?? DEFAULT_ADMIN_ARTICLE_PAGE_SIZE;
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1));
  const search = input.search?.trim();
  // TODO: ILIKE 中前导 `%` 会导致无法使用 B-tree 索引，从而触发全表扫描。
  // 建议启用 pg_trgm 扩展并在 title_en 和 title_zh 列上创建 GIN 三字元索引，
  // 以提升全文搜索性能。
  const searchFilter = search
    ? sql`(${articles.titleEn} ILIKE ${`%${search}%`} OR ${articles.titleZh} ILIKE ${`%${search}%`})`
    : undefined;
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(searchFilter);
  const totalCount = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select({
      id: articles.id,
      titleEn: articles.titleEn,
      titleZh: articles.titleZh,
      summaryEn: articles.summaryEn,
      summaryZh: articles.summaryZh,
      sourceName: feeds.name,
      status: articles.status,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(searchFilter)
    .orderBy(desc(articles.publishedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    rows: rows.map((article) => ({
      id: article.id,
      title: getArticleListTitle(article, lang),
      titleEn: article.titleEn,
      titleZh: article.titleZh,
      summary:
        lang === "zh"
          ? article.summaryZh
            ? stripMarkdown(article.summaryZh)
            : article.summaryEn
              ? stripMarkdown(article.summaryEn)
              : null
          : article.summaryEn
            ? stripMarkdown(article.summaryEn)
            : article.summaryZh
              ? stripMarkdown(article.summaryZh)
              : null,
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
  };
}

export async function getArticleDetail(articleId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.id, articleId));

  const row = rows[0];
  if (!row) return null;

  return { ...row.articles, sourceName: row.feeds.name };
}
