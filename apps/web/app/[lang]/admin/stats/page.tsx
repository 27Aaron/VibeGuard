import { desc, sql } from "drizzle-orm";
import { Activity, Clock3, Database, Gauge, Hash } from "lucide-react";

import { getDb, llmUsageLogs, schema } from "@vibeguard/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminTableSurfaceClassName } from "@/lib/admin-layout";
import { resolveLang } from "@/lib/i18n";

type ContentDb = NodePgDatabase<typeof schema>;

export const dynamic = "force-dynamic";

async function getStatsOverview(db: ContentDb) {
  const rows = await db
    .select({
      totalPromptTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.promptTokens}), 0)`,
      totalCompletionTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.completionTokens}), 0)`,
      totalCachedTokens: sql<number>`COALESCE(SUM(${llmUsageLogs.cachedTokens}), 0)`,
      totalCalls: sql<number>`COUNT(*)::int`,
      avgResponseTimeMs: sql<number>`COALESCE(AVG(${llmUsageLogs.responseTimeMs}), 0)::int`,
    })
    .from(llmUsageLogs);

  return rows[0];
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
    .orderBy(desc(sql`COUNT(*)`));
}

async function getDailyTrend(db: ContentDb, days: number = 30) {
  const result = await db.execute(sql`
    SELECT (created_at)::date::text AS date,
      COALESCE(SUM(prompt_tokens), 0) AS "promptTokens",
      COALESCE(SUM(completion_tokens), 0) AS "completionTokens",
      COALESCE(SUM(cached_tokens), 0) AS "cachedTokens",
      COUNT(*)::int AS calls
    FROM llm_usage_logs
    WHERE created_at >= NOW() - interval '${sql.raw(String(days))} days'
    GROUP BY (created_at)::date
    ORDER BY (created_at)::date
  `);
  return result.rows as Array<{
    date: string;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    calls: number;
  }>;
}

const TASK_TYPE_LABELS: Record<string, Record<string, string>> = {
  classify_relevance: { zh: "相关性判断", en: "Classify relevance" },
  translate_title: { zh: "标题翻译", en: "Translate title" },
  translate_content: { zh: "正文翻译", en: "Translate body" },
  summarize_en: { zh: "英文摘要", en: "English summary" },
  summarize_zh: { zh: "中文摘要", en: "Chinese summary" },
  generate_tags: { zh: "标签生成", en: "Generate tags" },
};

function formatNumber(
  n: number | string | null | undefined,
  lang: "zh" | "en",
) {
  const value = Number(n ?? 0);

  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString(lang === "zh" ? "zh-CN" : "en-US");
}

type StatsPageProps = {
  params: Promise<{ lang: string }>;
};

export default async function StatsPage({ params }: StatsPageProps) {
  const { lang: rawLang } = await params;
  const lang = resolveLang(rawLang);
  const db = getDb();

  const [overview, taskBreakdown, dailyTrend] = await Promise.all([
    getStatsOverview(db),
    getTaskBreakdown(db),
    getDailyTrend(db),
  ]);

  const totalPromptTokens = Number(overview.totalPromptTokens ?? 0);
  const totalCachedTokens = Number(overview.totalCachedTokens ?? 0);
  const cacheRate =
    totalPromptTokens > 0
      ? ((totalCachedTokens / totalPromptTokens) * 100).toFixed(1)
      : "0.0";

  const labels = {
    title: lang === "zh" ? "LLM 调用统计" : "LLM Usage Statistics",
    description:
      lang === "zh"
        ? "查看模型调用量、Token 消耗、缓存命中和响应耗时。"
        : "Review model calls, token usage, cache hits, and response latency.",
    taskKicker: lang === "zh" ? "调用分布" : "Breakdown",
    trendKicker: lang === "zh" ? "时间线" : "Timeline",
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
    taskDetail:
      lang === "zh"
        ? "按处理步骤拆分平均 Token、缓存率和响应时间。"
        : "Break down average tokens, cache rate, and latency by processing step.",
    trendDetail:
      lang === "zh"
        ? "按日期查看调用量与 Token 消耗的走势。"
        : "Track calls and token usage by day.",
    date: lang === "zh" ? "日期" : "Date",
    noData: lang === "zh" ? "暂无数据" : "No data yet",
  };
  const metricCards = [
    {
      label: labels.promptTokens,
      value: formatNumber(overview.totalPromptTokens, lang),
      detail: `${labels.cached} ${formatNumber(overview.totalCachedTokens, lang)}`,
      icon: Hash,
    },
    {
      label: labels.completionTokens,
      value: formatNumber(overview.totalCompletionTokens, lang),
      detail: lang === "zh" ? "模型输出消耗" : "Generated output usage",
      icon: Activity,
    },
    {
      label: labels.cacheRate,
      value: `${cacheRate}%`,
      detail: lang === "zh" ? "输入 Token 复用比例" : "Prompt token reuse",
      icon: Database,
    },
    {
      label: labels.totalCalls,
      value: formatNumber(overview.totalCalls, lang),
      detail: lang === "zh" ? "累计请求数" : "Total requests",
      icon: Gauge,
    },
    {
      label: labels.avgResponseTime,
      value: `${formatNumber(overview.avgResponseTimeMs, lang)} ms`,
      detail: lang === "zh" ? "平均端到端耗时" : "Average end-to-end time",
      icon: Clock3,
    },
  ];

  return (
    <AdminPageShell
      title={labels.title}
      description={labels.description}
      lang={lang}
    >
      <section className="flex flex-col gap-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metricCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.label}
                className="min-h-[116px] justify-center py-4"
              >
                <CardContent className="grid min-h-[88px] content-center gap-3 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <CardDescription className="leading-none">
                      {card.label}
                    </CardDescription>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-900/10 bg-[#f7fbf8] text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.06)] dark:border-emerald-200/14 dark:bg-[#18241e] dark:text-emerald-300 dark:shadow-none">
                      <Icon className="size-3.5" />
                    </span>
                  </div>
                  <CardTitle className="text-xl leading-none text-zinc-950 dark:text-stone-50">
                    {card.value}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{card.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <p className="font-heading text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">
                {labels.taskKicker}
              </p>
              <CardTitle>{labels.taskType}</CardTitle>
              <CardDescription>{labels.taskDetail}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className={getAdminTableSurfaceClassName()}>
              <Table>
                <TableHeader className="bg-white/56 dark:bg-white/[0.035]">
                  <TableRow>
                    <TableHead className="px-4">{labels.task}</TableHead>
                    <TableHead className="px-3 text-right">
                      {labels.calls}
                    </TableHead>
                    <TableHead className="px-3 text-right">
                      {labels.avgPrompt}
                    </TableHead>
                    <TableHead className="px-3 text-right">
                      {labels.avgCompletion}
                    </TableHead>
                    <TableHead className="px-3 text-right">
                      {labels.cacheCol}
                    </TableHead>
                    <TableHead className="px-4 text-right">
                      {labels.avgTime}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskBreakdown.map((row) => (
                    <TableRow key={row.taskType}>
                      <TableCell className="px-4 py-3 font-medium">
                        {TASK_TYPE_LABELS[row.taskType]?.[lang] ?? row.taskType}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right tabular-nums">
                        {formatNumber(row.callCount, lang)}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right tabular-nums">
                        {formatNumber(row.avgPromptTokens, lang)}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right tabular-nums">
                        {formatNumber(row.avgCompletionTokens, lang)}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right tabular-nums">
                        {row.cacheRate}%
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(row.avgResponseTimeMs, lang)} ms
                      </TableCell>
                    </TableRow>
                  ))}
                  {taskBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        {labels.noData}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <p className="font-heading text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">
                {labels.trendKicker}
              </p>
              <CardTitle>{labels.trend}</CardTitle>
              <CardDescription>{labels.trendDetail}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className={getAdminTableSurfaceClassName()}>
              <Table>
                <TableHeader className="bg-white/56 dark:bg-white/[0.035]">
                  <TableRow>
                    <TableHead className="px-4">{labels.date}</TableHead>
                    <TableHead className="px-3 text-right">
                      {labels.calls}
                    </TableHead>
                    <TableHead className="px-3 text-right">
                      {labels.promptTokens}
                    </TableHead>
                    <TableHead className="px-3 text-right">
                      {labels.completionTokens}
                    </TableHead>
                    <TableHead className="px-4 text-right">
                      {labels.cached}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyTrend.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="px-4 py-3 tabular-nums">
                        {row.date}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right tabular-nums">
                        {formatNumber(row.calls, lang)}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right tabular-nums">
                        {formatNumber(row.promptTokens, lang)}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right tabular-nums">
                        {formatNumber(row.completionTokens, lang)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(row.cachedTokens, lang)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dailyTrend.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        {labels.noData}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </AdminPageShell>
  );
}
