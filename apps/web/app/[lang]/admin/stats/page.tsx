import { desc, gte, sql } from "drizzle-orm"

import { getDb, llmUsageLogs, schema } from "@vibeguard/db"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { resolveLang } from "@/lib/i18n"

type ContentDb = NodePgDatabase<typeof schema>

async function getStatsOverview(db: ContentDb) {
  const rows = await db
    .select({
      totalPromptTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.promptTokens}), 0)`,
      totalCompletionTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.completionTokens}), 0)`,
      totalCachedTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.cachedTokens}), 0)`,
      totalCalls: sql<number>`COUNT(*)::int`,
      avgResponseTimeMs: sql<number>`COALESCE(AVG(${llmUsageLogs.responseTimeMs}), 0)::int`,
    })
    .from(llmUsageLogs)

  return rows[0]
}

async function getTaskBreakdown(db: ContentDb) {
  return db
    .select({
      taskType: llmUsageLogs.taskType,
      callCount: sql<number>`COUNT(*)::int`,
      avgPromptTokens: sql<number>`COALESCE(AVG(${llmUsageLogs.promptTokens}), 0)::int`,
      avgCompletionTokens: sql<number>`COALESCE(AVG(${llmUsageLogs.completionTokens}), 0)::int`,
      avgCachedTokens: sql<number>`COALESCE(AVG(COALESCE(${llmUsageLogs.cachedTokens}, 0)), 0)::int`,
      cacheRate: sql<number>`CASE WHEN SUM(${llmUsageLogs.promptTokens}) > 0 THEN (COALESCE(SUM(${llmUsageLogs.cachedTokens}), 0)::float / SUM(${llmUsageLogs.promptTokens}) * 100)::int ELSE 0 END`,
      avgResponseTimeMs: sql<number>`COALESCE(AVG(${llmUsageLogs.responseTimeMs}), 0)::int`,
    })
    .from(llmUsageLogs)
    .groupBy(llmUsageLogs.taskType)
    .orderBy(desc(sql`COUNT(*)`))
}

async function getDailyTrend(db: ContentDb, days: number = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  return db
    .select({
      date: sql<string>`DATE(${llmUsageLogs.createdAt})::text`,
      promptTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.promptTokens}), 0)`,
      completionTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.completionTokens}), 0)`,
      cachedTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.cachedTokens}), 0)`,
      calls: sql<number>`COUNT(*)::int`,
    })
    .from(llmUsageLogs)
    .where(gte(llmUsageLogs.createdAt, since))
    .groupBy(sql`DATE(${llmUsageLogs.createdAt})`)
    .orderBy(sql`DATE(${llmUsageLogs.createdAt})`)
}

const TASK_TYPE_LABELS: Record<string, Record<string, string>> = {
  classify_relevance: { zh: "相关性判断", en: "Classify relevance" },
  translate_title: { zh: "标题翻译", en: "Translate title" },
  translate_content: { zh: "正文翻译", en: "Translate body" },
  summarize_en: { zh: "英文摘要", en: "English summary" },
  summarize_zh: { zh: "中文摘要", en: "Chinese summary" },
  generate_tags: { zh: "标签生成", en: "Generate tags" },
}

function formatNumber(n: number) {
  return n.toLocaleString("zh-CN")
}

type StatsPageProps = {
  params: Promise<{ lang: string }>
}

export default async function StatsPage({ params }: StatsPageProps) {
  const { lang: rawLang } = await params
  const lang = rawLang === "en" ? "en" : "zh"
  const db = getDb()

  const [overview, taskBreakdown, dailyTrend] = await Promise.all([
    getStatsOverview(db),
    getTaskBreakdown(db),
    getDailyTrend(db),
  ])

  const cacheRate =
    overview.totalPromptTokens > 0
      ? ((overview.totalCachedTokens / overview.totalPromptTokens) * 100).toFixed(1)
      : "0.0"

  const labels = {
    title: lang === "zh" ? "LLM 调用统计" : "LLM Usage Statistics",
    promptTokens: lang === "zh" ? "输入 Token" : "Prompt Tokens",
    completionTokens: lang === "zh" ? "输出 Token" : "Completion Tokens",
    cacheRate: lang === "zh" ? "缓存命中率" : "Cache Hit Rate",
    totalCalls: lang === "zh" ? "总调用次数" : "Total Calls",
    avgResponseTime: lang === "zh" ? "平均响应时间" : "Avg Response Time",
    cached: lang === "zh" ? "缓存" : "Cached",
    taskType: lang === "zh" ? "按任务类型" : "By Task Type",
    calls: lang === "zh" ? "调用次数" : "Calls",
    avgPrompt: lang === "zh" ? "平均输入" : "Avg Prompt",
    avgCompletion: lang === "zh" ? "平均输出" : "Avg Completion",
    cacheCol: lang === "zh" ? "缓存率" : "Cache Rate",
    avgTime: lang === "zh" ? "平均耗时" : "Avg Time",
    task: lang === "zh" ? "任务类型" : "Task Type",
    trend: lang === "zh" ? "近 30 天趋势" : "30-Day Trend",
    date: lang === "zh" ? "日期" : "Date",
    noData: lang === "zh" ? "暂无数据" : "No data yet",
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <h1 className="text-2xl font-bold">{labels.title}</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">{labels.promptTokens}</div>
          <div className="text-2xl font-semibold">{formatNumber(overview.totalPromptTokens)}</div>
          <div className="text-xs text-muted-foreground">
            {labels.cached} {formatNumber(overview.totalCachedTokens)}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">{labels.completionTokens}</div>
          <div className="text-2xl font-semibold">{formatNumber(overview.totalCompletionTokens)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">{labels.cacheRate}</div>
          <div className="text-2xl font-semibold">{cacheRate}%</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">{labels.totalCalls}</div>
          <div className="text-2xl font-semibold">{formatNumber(overview.totalCalls)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">{labels.avgResponseTime}</div>
          <div className="text-2xl font-semibold">{overview.avgResponseTimeMs} ms</div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">{labels.taskType}</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">{labels.task}</th>
                <th className="px-4 py-2 text-right">{labels.calls}</th>
                <th className="px-4 py-2 text-right">{labels.avgPrompt}</th>
                <th className="px-4 py-2 text-right">{labels.avgCompletion}</th>
                <th className="px-4 py-2 text-right">{labels.cacheCol}</th>
                <th className="px-4 py-2 text-right">{labels.avgTime}</th>
              </tr>
            </thead>
            <tbody>
              {taskBreakdown.map((row) => (
                <tr key={row.taskType} className="border-t">
                  <td className="px-4 py-2">
                    {TASK_TYPE_LABELS[row.taskType]?.[lang] ?? row.taskType}
                  </td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.callCount)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.avgPromptTokens)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.avgCompletionTokens)}</td>
                  <td className="px-4 py-2 text-right">{row.cacheRate}%</td>
                  <td className="px-4 py-2 text-right">{row.avgResponseTimeMs} ms</td>
                </tr>
              ))}
              {taskBreakdown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    {labels.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">{labels.trend}</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">{labels.date}</th>
                <th className="px-4 py-2 text-right">{labels.calls}</th>
                <th className="px-4 py-2 text-right">{labels.promptTokens}</th>
                <th className="px-4 py-2 text-right">{labels.completionTokens}</th>
                <th className="px-4 py-2 text-right">{labels.cached}</th>
              </tr>
            </thead>
            <tbody>
              {dailyTrend.map((row) => (
                <tr key={row.date} className="border-t">
                  <td className="px-4 py-2">{row.date}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.calls)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.promptTokens)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.completionTokens)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.cachedTokens)}</td>
                </tr>
              ))}
              {dailyTrend.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    {labels.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
