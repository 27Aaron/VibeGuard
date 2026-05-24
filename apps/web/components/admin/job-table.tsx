import Link from "next/link"

import { JobSelectAllCheckbox } from "@/components/admin/job-select-all-checkbox"
import { JobStageFilterSelect } from "@/components/admin/job-stage-filter-select"
import {
  cancelJobAction,
  pauseJobAction,
  resumeJobAction,
  retryJobAction,
} from "@/lib/actions/jobs"
import type { JobRow, JobStageFilter, JobStatusFilter } from "@/components/admin/types"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getAdminTableSurfaceClassName } from "@/lib/admin-layout"
import type { AppLang } from "@/lib/i18n"
import { PIPELINE_STAGES, stageLabel } from "@/lib/pipeline-stages"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Rows beyond this threshold use content-visibility: auto for
// browser-native virtualization (skip off-screen layout/paint).
const VIRTUALIZE_THRESHOLD = 30
const ESTIMATED_ROW_HEIGHT = 56

function statusVariant(status: JobRow["status"]) {
  if (status === "failed" || status === "cancel_requested") {
    return "destructive" as const
  }

  if (status === "succeeded") {
    return "secondary" as const
  }

  return "outline" as const
}

function statusClassName(status: JobRow["status"]) {
  if (status === "filtered") {
    return "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
  }
  if (status === "paused" || status === "pause_requested") {
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
  }
  return undefined
}

function statusLabel(status: JobRow["status"], lang: AppLang) {
  switch (status) {
    case "queued":
      return lang === "zh" ? "排队中" : "Queued"
    case "running":
      return lang === "zh" ? "执行中" : "Running"
    case "paused":
      return lang === "zh" ? "已暂停" : "Paused"
    case "pause_requested":
      return lang === "zh" ? "暂停中" : "Pausing"
    case "cancel_requested":
      return lang === "zh" ? "取消中" : "Cancelling"
    case "succeeded":
      return lang === "zh" ? "已完成" : "Succeeded"
    case "failed":
      return lang === "zh" ? "失败" : "Failed"
    case "filtered":
      return lang === "zh" ? "已过滤" : "Filtered"
  }
}

function displayStageLabel(job: JobRow, lang: AppLang) {
  if (job.status === "succeeded" || job.status === "filtered") {
    return lang === "zh" ? "处理完成" : "Processing complete"
  }

  return stageLabel(job.pipelineStage, lang)
}

function pipelineProgress(job: JobRow) {
  if (job.status === "succeeded") {
    return { current: PIPELINE_STAGES.length, total: PIPELINE_STAGES.length }
  }

  const index = PIPELINE_STAGES.indexOf(job.pipelineStage)

  return {
    current: index >= 0 ? index + 1 : 1,
    total: PIPELINE_STAGES.length,
  }
}

function actionLabel(status: JobRow["status"], lang: AppLang) {
  switch (status) {
    case "queued":
      return lang === "zh" ? "立即执行" : "Run now"
    case "running":
      return lang === "zh" ? "重置执行" : "Reset"
    case "paused":
      return lang === "zh" ? "恢复" : "Resume"
    case "pause_requested":
      return lang === "zh" ? "暂停中" : "Pausing"
    case "cancel_requested":
      return lang === "zh" ? "取消中" : "Cancelling"
    case "succeeded":
      return lang === "zh" ? "重新执行" : "Rerun"
    case "filtered":
      return lang === "zh" ? "重新执行" : "Rerun"
    case "failed":
      return lang === "zh" ? "继续执行" : "Continue"
  }
}

function JobActionHiddenFields({
  job,
  lang,
  status,
  stage,
  page,
  pageSize,
}: {
  job: JobRow
  lang: AppLang
  status: JobStatusFilter
  stage: JobStageFilter
  page: number
  pageSize: number
}) {
  return (
    <>
      <input type="hidden" name="id" value={job.id} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="stage" value={stage} />
      <input type="hidden" name="page" value={String(page)} />
      <input type="hidden" name="pageSize" value={String(pageSize)} />
    </>
  )
}

function JobRowActions({
  job,
  lang,
  status,
  stage,
  page,
  pageSize,
}: {
  job: JobRow
  lang: AppLang
  status: JobStatusFilter
  stage: JobStageFilter
  page: number
  pageSize: number
}) {
  const canPause = job.status === "queued" || job.status === "running"
  const canResume = job.status === "paused"
  const canCancel =
    job.status === "queued" ||
    job.status === "running" ||
    job.status === "paused" ||
    job.status === "pause_requested"
  const canRetry =
    job.status === "failed" ||
    job.status === "succeeded" ||
    job.status === "filtered"

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {canRetry ? (
        <form action={retryJobAction} className="inline-flex">
          <JobActionHiddenFields
            job={job}
            lang={lang}
            status={status}
            stage={stage}
            page={page}
            pageSize={pageSize}
          />
          <button
            type="submit"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "w-16 justify-center px-0",
            )}
          >
            {actionLabel(job.status, lang)}
          </button>
        </form>
      ) : null}
      {canPause ? (
        <form action={pauseJobAction} className="inline-flex">
          <JobActionHiddenFields
            job={job}
            lang={lang}
            status={status}
            stage={stage}
            page={page}
            pageSize={pageSize}
          />
          <button
            type="submit"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "w-14 justify-center px-0",
            )}
          >
            {lang === "zh" ? "暂停" : "Pause"}
          </button>
        </form>
      ) : null}
      {canResume ? (
        <form action={resumeJobAction} className="inline-flex">
          <JobActionHiddenFields
            job={job}
            lang={lang}
            status={status}
            stage={stage}
            page={page}
            pageSize={pageSize}
          />
          <button
            type="submit"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "w-14 justify-center px-0",
            )}
          >
            {lang === "zh" ? "恢复" : "Resume"}
          </button>
        </form>
      ) : null}
      {job.status === "pause_requested" || job.status === "cancel_requested" ? (
        <button
          type="button"
          disabled
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "w-16 justify-center px-0",
          )}
        >
          {actionLabel(job.status, lang)}
        </button>
      ) : null}
      {canCancel ? (
        <form action={cancelJobAction} className="inline-flex">
          <JobActionHiddenFields
            job={job}
            lang={lang}
            status={status}
            stage={stage}
            page={page}
            pageSize={pageSize}
          />
          <button
            type="submit"
            className={cn(
              buttonVariants({ size: "sm", variant: "destructive" }),
              "w-14 justify-center px-0",
            )}
          >
            {lang === "zh" ? "取消" : "Cancel"}
          </button>
        </form>
      ) : null}
    </div>
  )
}

function JobRowItem({ job, lang, status, stage, page, pageSize, shouldVirtualize }: {
  job: JobRow
  lang: AppLang
  status: JobStatusFilter
  stage: JobStageFilter
  page: number
  pageSize: number
  shouldVirtualize: boolean
}) {
  const { current, total } = pipelineProgress(job)
  const percent = Math.round((current / total) * 100)

  return (
    <TableRow
      style={shouldVirtualize ? {
        containIntrinsicSize: ESTIMATED_ROW_HEIGHT,
        contentVisibility: "auto",
      } : undefined}
    >
      <TableCell className="px-4 py-3 align-middle">
        <label className="flex cursor-pointer items-center justify-center">
          <input
            aria-label={
              lang === "zh"
                ? `选择 ${job.articleTitle}`
                : `Select ${job.articleTitle}`
            }
            form="selected-jobs-form"
            name="ids"
            type="checkbox"
            value={job.id}
          />
        </label>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/${lang}/admin/articles/${job.articleId}`}
            className="truncate font-medium hover:underline"
          >
            {job.articleTitle}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {job.sourceName}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 text-center align-middle">
        <Badge variant={job.status === "succeeded" ? "secondary" : "outline"}>
          {displayStageLabel(job, lang)}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-3 align-middle">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">
            {current}/{total}
          </span>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                job.status === "failed"
                  ? "bg-destructive"
                  : "bg-emerald-500",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 text-center align-middle">
        <Badge variant={statusVariant(job.status)} className={statusClassName(job.status)}>
          {statusLabel(job.status, lang)}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-3 text-center align-middle">
        {`${job.attempt}/${job.maxAttempts}`}
      </TableCell>
      <TableCell className="px-3 py-3 text-center align-middle tabular-nums">{job.runAt}</TableCell>
      <TableCell className="px-3 py-3 text-center align-middle tabular-nums">{job.updatedAt}</TableCell>
      <TableCell className="px-3 py-3 text-center align-middle">
        {job.lastError ? (
          <p className="line-clamp-2 text-xs text-destructive" title={job.lastError}>{job.lastError}</p>
        ) : (
          <span className="text-xs text-muted-foreground">
            {lang === "zh" ? "无错误" : "No error"}
          </span>
        )}
      </TableCell>
      <TableCell className="px-4 py-3 text-center align-middle">
        <JobRowActions
          job={job}
          lang={lang}
          status={status}
          stage={stage}
          page={page}
          pageSize={pageSize}
        />
      </TableCell>
    </TableRow>
  )
}

export function JobTable({
  jobs,
  lang,
  status,
  stage,
  page,
  pageSize,
}: {
  jobs: JobRow[]
  lang: AppLang
  status: JobStatusFilter
  stage: JobStageFilter
  page: number
  pageSize: number
}) {
  const shouldVirtualize = jobs.length > VIRTUALIZE_THRESHOLD

  return (
    <div className={getAdminTableSurfaceClassName()} style={{ overscrollBehavior: "contain" } as React.CSSProperties}>
      <Table className="table-fixed">
        <TableHeader className="bg-white/56 dark:bg-white/[0.035]">
          <TableRow>
            <TableHead className="w-14 px-4">
              <JobSelectAllCheckbox
                formId="selected-jobs-form"
                inputName="ids"
                label={lang === "zh" ? "全选当前页任务" : "Select all jobs on this page"}
              />
            </TableHead>
            <TableHead className="w-[22%] px-4 text-left">
              {lang === "zh" ? "内容" : "Content"}
            </TableHead>
            <TableHead className="w-[120px] px-3 text-center">
              <JobStageFilterSelect
                lang={lang}
                status={status}
                stage={stage}
                pageSize={pageSize}
              />
            </TableHead>
            <TableHead className="w-[130px] px-3 text-center">
              {lang === "zh" ? "进度" : "Progress"}
            </TableHead>
            <TableHead className="w-[96px] px-3 text-center">
              {lang === "zh" ? "状态" : "Status"}
            </TableHead>
            <TableHead className="w-[96px] px-3 text-center">
              {lang === "zh" ? "尝试次数" : "Attempts"}
            </TableHead>
            <TableHead className="w-[140px] px-3 text-center">
              {lang === "zh" ? "计划执行" : "Scheduled"}
            </TableHead>
            <TableHead className="w-[140px] px-3 text-center">
              {lang === "zh" ? "更新时间" : "Updated at"}
            </TableHead>
            <TableHead className="w-[140px] px-3 text-center">
              {lang === "zh" ? "错误信息" : "Error"}
            </TableHead>
            <TableHead className="w-[156px] px-4 text-center">
              {lang === "zh" ? "操作" : "Actions"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 ? (
            <TableRow>
              <TableCell className="px-4 py-5 text-center text-sm text-muted-foreground" colSpan={10}>
                {lang === "zh"
                  ? "当前筛选条件下还没有任务记录。"
                  : "No jobs match the current filter."}
              </TableCell>
            </TableRow>
          ) : null}
          {jobs.map((job) => (
            <JobRowItem
              key={job.id}
              job={job}
              lang={lang}
              status={status}
              stage={stage}
              page={page}
              pageSize={pageSize}
              shouldVirtualize={shouldVirtualize}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
