import { eq, sql } from "drizzle-orm"

import { articles, feeds, getDb, getPool } from "@vibeguard/db"

import { listArticles } from "./api-articles"

export async function getPublicArticleFeed(searchParams: URLSearchParams) {
  return listArticles(searchParams)
}

export async function getPublicOverview() {
  const db = getDb()
  const [articleCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(eq(articles.status, "ready"))
  const [sourceCountRow] = await db
    .select({ count: sql<number>`count(distinct ${articles.feedId})` })
    .from(articles)
    .where(eq(articles.status, "ready"))

  return {
    articleCount: Number(articleCountRow?.count ?? 0),
    sourceCount: Number(sourceCountRow?.count ?? 0),
  }
}

export async function getPublicSources() {
  const db = getDb()
  const rows = await db
    .select({
      sourceName: feeds.name,
      count: sql<number>`count(*)`,
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(articles.status, "ready"))
    .groupBy(feeds.name)

  return rows
    .map((row) => ({
      sourceName: row.sourceName,
      count: Number(row.count ?? 0),
    }))
    .sort((left, right) => left.sourceName.localeCompare(right.sourceName))
}

export async function getPublicTags() {
  const result = await getPool().query<{ tag: string; count: number }>(
    `
      select tag, count(*)::int as count
      from articles, jsonb_array_elements_text(tags) as tag
      where status = 'ready'
      group by tag
      order by count desc, tag asc
    `,
  )

  return result.rows
}
