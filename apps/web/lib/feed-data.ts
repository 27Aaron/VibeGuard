import { desc, eq } from "drizzle-orm"
import { getDb, feeds } from "@vibeguard/db"
import type { AppLang } from "./i18n"
import { formatDateTimeInShanghai } from "./time"

function formatDateTime(value: Date | null | undefined, lang: AppLang = "zh", fallback?: string) {
  return formatDateTimeInShanghai(value, { lang, fallback })
}

export async function getFeedRows(lang: AppLang = "zh") {
  const db = getDb()
  const rows = await db
    .select()
    .from(feeds)
    .orderBy(desc(feeds.createdAt))

  return rows.map((feed) => ({
    id: feed.id,
    name: feed.name,
    siteUrl: feed.siteUrl,
    feedUrl: feed.feedUrl,
    feedType: feed.feedType,
    pollIntervalMinutes: feed.pollIntervalMinutes,
    enabled: feed.enabled,
    cadence:
      lang === "zh"
        ? `${feed.pollIntervalMinutes} 分钟`
        : `${feed.pollIntervalMinutes} minutes`,
    status: feed.enabled ? ("enabled" as const) : ("paused" as const),
    lastSyncedAt: feed.lastSuccessAt
      ? formatDateTimeInShanghai(feed.lastSuccessAt)
      : lang === "zh"
        ? "尚未同步"
        : "Not synced yet",
  }))
}

export async function getFeedDetail(feedId: string) {
  const db = getDb()

  return db.query.feeds.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, feedId),
  })
}
