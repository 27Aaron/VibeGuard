import Link from "next/link"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"

import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { SoftLink } from "@/components/admin/soft-link"
import { JobTable } from "@/components/admin/job-table"
import type { JobStageFilter, JobStatusFilter } from "@/components/admin/types"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { retryFailedJobsAction, retrySelectedJobsAction } from "@/lib/actions/jobs"
import {
  ADMIN_JOB_PAGE_SIZE_OPTIONS,
  parseAdminJobListParams,
} from "@/lib/admin-job-pagination"
import { getJobRows, getJobStatusCounts } from "@/lib/admin-data"
import { getAdminSubtlePanelClassName } from "@/lib/admin-layout"
import { resolveLang, type AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const allowedStatuses = new Set<JobStatusFilter>([
  "all",
  "running",
  "succeeded",
  "failed",
  "filtered",
])

type JobsPageProps = {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{
    status?: string
    stage?: string
    page?: string
    pageSize?: string
    message?: string
    result?: string
  }>
}

function buildJobsHref(input: {
  lang: AppLang
  status: JobStatusFilter
  stage: JobStageFilter
  page: number
  pageSize: number
}) {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  })

  if (input.status !== "all") {
    params.set("status", input.status)
  }

  if (input.stage !== "all") {
    params.set("stage", input.stage)
  }

  return `/${input.lang}/admin/jobs?${params.toString()}`
}

function buildCurrentPath(status: JobStatusFilter, stage: JobStageFilter) {
  const params = new URLSearchParams()

  if (status !== "all") {
    params.set("status", status)
  }

  if (stage !== "all") {
    params.set("stage", stage)
  }

  const query = params.toString()

  return query ? `/admin/jobs?${query}` : "/admin/jobs"
}

export default async function JobsPage({ params: routeParams, searchParams }: JobsPageProps) {
  const { lang: rawLang } = await routeParams
  const params = (await searchParams) ?? {}
  const lang = resolveLang(rawLang)
  const status = allowedStatuses.has((params.status as JobStatusFilter) ?? "all")
    ? ((params.status as JobStatusFilter) ?? "all")
    : "all"
  const paginationParams = parseAdminJobListParams(params)
  const stage = paginationParams.stage
  const [{ rows: jobs, pagination }, counts] = await Promise.all([
    getJobRows({
      status,
      stage,
      lang,
      page: paginationParams.page,
      pageSize: paginationParams.pageSize,
    }),
    getJobStatusCounts(lang),
  ])
  const rangeText =
    lang === "zh"
      ? `共 ${pagination.totalCount} 条，当前 ${pagination.from}-${pagination.to}`
      : `${pagination.from}-${pagination.to} of ${pagination.totalCount} jobs`
  const previousPage = Math.max(1, pagination.page - 1)
  const nextPage = Math.min(pagination.totalPages, pagination.page + 1)
  const hasPreviousPage = pagination.page > 1
  const hasNextPage = pagination.page < pagination.totalPages
  const hasSelectableJobs = jobs.length > 0

  return (
    <AdminPageShell
      title={lang === "zh" ? "任务" : "Jobs"}
      description={
        lang === "zh"
          ? "按内容链路查看处理状态，定位每篇文章卡在了哪个步骤。"
          : "Review content pipelines and pinpoint which step each article is blocked on."
      }
      currentNav="/admin/jobs"
      currentPath={buildCurrentPath(status, stage)}
      lang={lang}
    >
      {params.message ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            params.result === "success"
              ? "border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
              : "border-destructive/40 bg-destructive/5 text-destructive dark:bg-destructive/10",
          )}
        >
          {params.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {counts.map((item) => {
          const href = buildJobsHref({
            lang,
            status: item.status,
            stage,
            page: 1,
            pageSize: pagination.pageSize,
          })
          const active = status === item.status

          return (
            <Link
              key={item.status}
              href={href}
              className={cn(
                "rounded-[1.2rem] border border-black/5 bg-white/58 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-emerald-900/15 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-emerald-200/20 dark:hover:bg-white/[0.065]",
                active &&
                  "border-emerald-900/18 bg-[#f7fbf8] dark:border-emerald-200/14 dark:bg-[#121b17]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                {active ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-2xl font-semibold">{item.count}</p>
            </Link>
          )
        })}
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{lang === "zh" ? "内容处理链路" : "Content pipeline"}</CardTitle>
            <CardDescription>
              {lang === "zh"
                ? "跟踪每篇内容从抓取到摘要的处理进度。"
                : "Track each content item from source fetch through summary."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action={retryFailedJobsAction}>
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="stage" value={stage} />
              <input type="hidden" name="page" value={String(pagination.page)} />
              <input type="hidden" name="pageSize" value={String(pagination.pageSize)} />
              <button
                type="submit"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                {lang === "zh" ? "继续执行全部失败" : "Continue all failed"}
              </button>
            </form>
            <form id="selected-jobs-form" action={retrySelectedJobsAction}>
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="stage" value={stage} />
              <input type="hidden" name="page" value={String(pagination.page)} />
              <input type="hidden" name="pageSize" value={String(pagination.pageSize)} />
            </form>
            <button
              type="submit"
              form="selected-jobs-form"
              disabled={!hasSelectableJobs}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {lang === "zh" ? "执行选中" : "Run selected"}
            </button>
            <Link
              href={buildJobsHref({
                lang,
                status: "all",
                stage: "all",
                page: 1,
                pageSize: pagination.pageSize,
              })}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              {lang === "zh" ? "清除筛选" : "Clear filters"}
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <div className={cn("mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", getAdminSubtlePanelClassName())}>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-zinc-950 dark:text-stone-100">
                {rangeText}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === "zh"
                  ? `第 ${pagination.page} / ${pagination.totalPages} 页`
                  : `Page ${pagination.page} of ${pagination.totalPages}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {lang === "zh" ? "每页展示" : "Rows per page"}
              </span>
              <div className="flex items-center gap-1 rounded-full border border-black/8 bg-[#eef2f7] p-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] dark:border-white/8 dark:bg-[#11161d] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)]">
                {ADMIN_JOB_PAGE_SIZE_OPTIONS.map((option) => (
                  <SoftLink
                    key={option}
                    href={buildJobsHref({
                      lang,
                      status,
                      stage,
                      page: 1,
                      pageSize: option,
                    })}
                    className={cn(
                      buttonVariants({
                        size: "xs",
                        variant:
                          option === pagination.pageSize ? "secondary" : "ghost",
                      }),
                      "min-w-8",
                    )}
                    aria-current={option === pagination.pageSize ? "page" : undefined}
                  >
                    {option}
                  </SoftLink>
                ))}
              </div>
            </div>
          </div>
          <JobTable
            jobs={jobs}
            lang={lang}
            status={status}
            stage={stage}
            page={pagination.page}
            pageSize={pagination.pageSize}
          />
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-2">
              <SoftLink
                href={buildJobsHref({
                  lang,
                  status,
                  stage,
                  page: previousPage,
                  pageSize: pagination.pageSize,
                })}
                disabled={!hasPreviousPage}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  !hasPreviousPage && "pointer-events-none opacity-50",
                )}
              >
                <ChevronLeft className="size-3.5" />
                {lang === "zh" ? "上一页" : "Previous"}
              </SoftLink>
              <SoftLink
                href={buildJobsHref({
                  lang,
                  status,
                  stage,
                  page: nextPage,
                  pageSize: pagination.pageSize,
                })}
                disabled={!hasNextPage}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  !hasNextPage && "pointer-events-none opacity-50",
                )}
              >
                {lang === "zh" ? "下一页" : "Next"}
                <ChevronRight className="size-3.5" />
              </SoftLink>
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminPageShell>
  )
}
