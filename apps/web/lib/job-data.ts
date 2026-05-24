import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  articles,
  feeds,
  getDb,
  llmSettings,
  processingJobs,
} from "@vibeguard/db";
import { JobStatus } from "@vibeguard/shared";
import {
  DEFAULT_ADMIN_JOB_PAGE_SIZE,
  type AdminJobStageFilter,
  type AdminJobListParams,
} from "./admin-job-pagination";
import type { AppLang } from "./i18n";
import { formatDateTimeInShanghai } from "./time";
import { normalizeUserFacingError } from "./errors";

function formatDateTime(
  value: Date | null | undefined,
  lang: AppLang = "zh",
  fallback?: string,
) {
  return formatDateTimeInShanghai(value, { lang, fallback });
}

const RUNNING_JOB_STATUSES = [
  JobStatus.RUNNING,
  JobStatus.PAUSE_REQUESTED,
  JobStatus.CANCEL_REQUESTED,
] as const;
const VISIBLE_JOB_STATUSES = [
  JobStatus.QUEUED,
  JobStatus.RUNNING,
  JobStatus.PAUSE_REQUESTED,
  JobStatus.CANCEL_REQUESTED,
  JobStatus.PAUSED,
  JobStatus.FAILED,
] as const;

export async function getDashboardOverview(lang: AppLang = "zh") {
  const db = getDb();
  const [feedCountRow, articleCountRow, queuedJobsRow, activeSettings] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(feeds),
      db.select({ count: sql<number>`count(*)` }).from(articles),
      db
        .select({ count: sql<number>`count(*)` })
        .from(processingJobs)
        .where(inArray(processingJobs.status, VISIBLE_JOB_STATUSES)),
      db.query.llmSettings.findFirst({
        where: (table, { eq: whereEq }) => whereEq(table.isActive, true),
      }),
    ]);

  return [
    {
      title: lang === "zh" ? "内容来源" : "Sources",
      value: String(feedCountRow[0]?.count ?? 0),
      detail:
        lang === "zh"
          ? "已配置并可纳入采集的来源"
          : "Configured sources available for ingestion",
    },
    {
      title: lang === "zh" ? "文章入库" : "Stored articles",
      value: String(articleCountRow[0]?.count ?? 0),
      detail:
        lang === "zh"
          ? "已经生成记录的文章总数"
          : "Article records currently stored",
    },
    {
      title: lang === "zh" ? "待处理任务" : "Active jobs",
      value: String(queuedJobsRow[0]?.count ?? 0),
      detail:
        lang === "zh"
          ? "排队中或执行中的处理任务"
          : "Queued or currently running jobs",
    },
    {
      title: lang === "zh" ? "当前模型" : "Active model",
      value:
        activeSettings?.model ??
        (lang === "zh" ? "未配置生效模型" : "No active model configured"),
      detail: activeSettings
        ? lang === "zh"
          ? "Worker 当前使用的模型配置"
          : "Model profile currently used by the worker"
        : lang === "zh"
          ? "请先配置模型服务访问参数"
          : "Configure model service access before processing articles",
    },
  ] as const;
}

export async function getJobPreviewRows() {
  const db = getDb();
  const rows = await db
    .select({
      id: processingJobs.id,
      jobType: processingJobs.jobType,
      status: processingJobs.status,
      runAfter: processingJobs.runAfter,
      articleTitle: articles.titleZh,
      fallbackTitle: articles.titleEn,
    })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .where(
      inArray(processingJobs.status, [
        JobStatus.QUEUED,
        ...RUNNING_JOB_STATUSES,
      ]),
    )
    .orderBy(desc(processingJobs.createdAt))
    .limit(5);

  return rows.map((row) => ({
    id: row.id,
    articleTitle: row.articleTitle || row.fallbackTitle,
    jobType: row.jobType,
    status: row.status,
    runAt: formatDateTime(row.runAfter),
  }));
}

export async function getJobStatusCounts(lang: AppLang = "zh") {
  const db = getDb();
  const counts = await db
    .select({
      status: processingJobs.status,
      count: sql<number>`count(*)`,
    })
    .from(processingJobs)
    .groupBy(processingJobs.status);

  const countMap = new Map(
    counts.map((row) => [row.status, Number(row.count)]),
  );

  // 统计被过滤的文章关联的任务数
  const [filteredCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .where(eq(articles.status, "filtered"));
  const filteredCount = Number(filteredCountRow?.count ?? 0);

  return [
    {
      status: "all",
      label: lang === "zh" ? "全部内容" : "All content",
      count: VISIBLE_JOB_STATUSES.reduce(
        (total, status) => total + (countMap.get(status) ?? 0),
        0,
      ),
    },
    {
      status: "running",
      label: lang === "zh" ? "执行中" : "Running",
      count: RUNNING_JOB_STATUSES.reduce(
        (total, status) => total + (countMap.get(status) ?? 0),
        0,
      ),
    },
    {
      status: "queued",
      label: lang === "zh" ? "排队中" : "Queued",
      count: countMap.get("queued") ?? 0,
    },
    {
      status: "paused",
      label: lang === "zh" ? "已暂停" : "Paused",
      count: countMap.get("paused") ?? 0,
    },
    {
      status: "failed",
      label: lang === "zh" ? "失败" : "Failed",
      count: countMap.get("failed") ?? 0,
    },
    {
      status: "filtered",
      label: lang === "zh" ? "已过滤" : "Filtered",
      count: filteredCount,
    },
  ] as const;
}

type JobStatusInput =
  | "all"
  | "running"
  | "queued"
  | "paused"
  | "failed"
  | "filtered";

export async function getJobRows(
  input: Partial<AdminJobListParams> & {
    status?: JobStatusInput;
    lang?: AppLang;
  } = {},
) {
  const db = getDb();
  const status = input.status ?? "all";
  const stage = input.stage ?? "all";
  const lang = input.lang ?? "zh";
  const pageSize = input.pageSize ?? DEFAULT_ADMIN_JOB_PAGE_SIZE;
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1));
  const visibleJobFilter = inArray(processingJobs.status, VISIBLE_JOB_STATUSES);
  const filters = [
    status === "all"
      ? visibleJobFilter
      : status === "filtered"
        ? eq(articles.status, "filtered")
        : status === "running"
          ? inArray(processingJobs.status, RUNNING_JOB_STATUSES)
          : eq(processingJobs.status, status),
    stage === "all"
      ? undefined
      : eq(
          processingJobs.pipelineStage,
          stage as Exclude<AdminJobStageFilter, "all">,
        ),
  ].filter(Boolean);
  const useJoin = status === "filtered";
  const baseQuery = useJoin
    ? db
        .select({ count: sql<number>`count(*)` })
        .from(processingJobs)
        .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    : db.select({ count: sql<number>`count(*)` }).from(processingJobs);
  const where = filters.length > 0 ? and(...filters) : undefined;
  const [countRow] = await baseQuery.where(where);
  const totalCount = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select({
      id: processingJobs.id,
      articleId: articles.id,
      articleTitleZh: articles.titleZh,
      articleTitleEn: articles.titleEn,
      sourceName: feeds.name,
      jobType: processingJobs.jobType,
      status: processingJobs.status,
      pipelineStage: processingJobs.pipelineStage,
      attempt: processingJobs.attempt,
      maxAttempts: processingJobs.maxAttempts,
      runAfter: processingJobs.runAfter,
      startedAt: processingJobs.startedAt,
      finishedAt: processingJobs.finishedAt,
      updatedAt: processingJobs.updatedAt,
      lastError: processingJobs.lastError,
    })
    .from(processingJobs)
    .innerJoin(articles, sql`${processingJobs.articleId} = ${articles.id}`)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(where)
    .orderBy(desc(processingJobs.updatedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      articleId: row.articleId,
      articleTitle: row.articleTitleZh || row.articleTitleEn,
      sourceName: row.sourceName,
      jobType: row.jobType,
      status: status === "filtered" ? ("filtered" as const) : row.status,
      pipelineStage:
        status === "filtered"
          ? ("classify_relevance" as const)
          : row.pipelineStage,
      attempt: row.attempt,
      maxAttempts: row.maxAttempts,
      runAt: formatDateTime(row.runAfter, lang),
      startedAt: formatDateTime(
        row.startedAt,
        lang,
        lang === "zh" ? "尚未开始" : "Not started",
      ),
      finishedAt: formatDateTime(
        row.finishedAt,
        lang,
        lang === "zh" ? "尚未结束" : "Not finished",
      ),
      updatedAt: formatDateTime(row.updatedAt, lang),
      lastError: row.lastError
        ? normalizeUserFacingError(new Error(row.lastError), lang)
        : null,
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
