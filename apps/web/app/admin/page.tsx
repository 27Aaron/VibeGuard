import Link from "next/link"
import { ArrowRight, Bot, FileText, Rss, Workflow } from "lucide-react"

import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { RunWorkerForm } from "@/components/admin/run-worker-form"
import { WorkerStatusPanel } from "@/components/admin/worker-status-panel"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { runWorkerOnceAction } from "@/lib/actions/worker"
import { getDashboardOverview, getJobPreviewRows } from "@/lib/admin-data"
import { getAdminSubtlePanelClassName } from "@/lib/admin-layout"
import { resolveLang } from "@/lib/i18n"
import { decodeWorkerRunDetails } from "@/lib/worker-run"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

function statusTone(status: string) {
  if (status === "failed") {
    return "text-destructive"
  }

  if (status === "succeeded") {
    return "text-foreground"
  }

  return "text-muted-foreground"
}

function runTone(run: string | undefined) {
  if (run === "failed") {
    return "border-destructive/40 bg-destructive/5 text-destructive dark:bg-destructive/10"
  }

  if (run === "warning") {
    return "border-amber-900/18 bg-amber-50/70 text-amber-950 dark:border-amber-200/14 dark:bg-amber-200/8 dark:text-amber-100"
  }

  return "border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
}

type AdminEntry = {
  title: string
  description: string
  href: string
  icon: typeof Rss
}

function buildAdminHref(lang: string, segment: string) {
  return `/${["admin", segment].join("/")}?lang=${lang}`
}

type AdminHomePageProps = {
  searchParams?: Promise<{
    lang?: string
    run?: string
    feeds?: string
    succeeded?: string
    failed?: string
    jobs?: string
    message?: string
    details?: string
  }>
}

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  const params = (await searchParams) ?? {}
  const lang = resolveLang(params.lang)
  const [overviewCards, jobPreviewRows] = await Promise.all([
    getDashboardOverview(lang),
    getJobPreviewRows(),
  ])
  const copy =
    lang === "zh"
      ? {
          title: "总览",
          description: "集中查看来源、文章、任务和模型配置的运行状态。",
          statusTitle: "运行状态",
          statusBody: "用四个指标快速判断采集、处理和模型链路是否可用。",
          operationsTitle: "常用操作",
          operationsBody: "高频入口集中在这里：手动跑一轮，或进入对应模块继续处理。",
          queueTitle: "处理队列",
          queueBody: "最近 5 条 Worker 任务，优先关注失败和长时间排队的项目。",
          runSuccessPrefix: "本轮 Worker 已完成：",
          runSuccessSuffix: "个来源抓取成功，处理了",
          runSuccessJobsSuffix: "个任务。",
          runFailed: "本轮 Worker 执行失败，请查看任务队列里的错误信息。",
          succeeded: "已完成",
          failed: "失败",
          processing: "处理中",
          jobsEmptyStateTitle: "任务队列还是空的",
          noJobs: "还没有任务。先添加来源，再抓取并处理一次即可看到任务进入队列。",
          jobTypeLabel: "步骤",
          jobStatusLabel: "状态",
          jobTimeLabel: "计划执行",
          extract: "正文提取",
          translate: "翻译",
          summarize: "摘要",
          viewJobs: "查看完整任务列表",
          entries: [
            {
              title: "来源",
              description: "维护 RSS/Atom 来源，调整同步节奏。",
              href: buildAdminHref(lang, "feeds"),
              icon: Rss,
            },
            {
              title: "文章",
              description: "检查入库内容，重生成标题、正文和摘要。",
              href: buildAdminHref(lang, "articles"),
              icon: FileText,
            },
            {
              title: "任务",
              description: "追踪处理步骤，定位失败并重试。",
              href: buildAdminHref(lang, "jobs"),
              icon: Workflow,
            },
            {
              title: "设置",
              description: "配置模型服务，维护翻译和摘要提示词。",
              href: buildAdminHref(lang, "settings"),
              icon: Bot,
            },
          ] satisfies AdminEntry[],
        }
      : {
          title: "Overview",
          description: "Review source, article, job, and model status in one place.",
          statusTitle: "Operating status",
          statusBody:
            "Four metrics for checking whether ingestion, processing, and model access are usable.",
          operationsTitle: "Common actions",
          operationsBody:
            "Start one manual cycle or jump into the module that needs attention.",
          queueTitle: "Processing queue",
          queueBody:
            "The latest 5 worker jobs, with failed and long-queued items first in mind.",
          runSuccessPrefix: "Worker cycle finished:",
          runSuccessSuffix: "sources succeeded, and",
          runSuccessJobsSuffix: "jobs were processed.",
          runFailed: "This worker cycle failed. Check the job queue for the error.",
          succeeded: "Succeeded",
          failed: "Failed",
          processing: "Processing",
          jobsEmptyStateTitle: "The job queue is still empty",
          noJobs:
            "No jobs yet. Add a source, then run one manual cycle to push jobs into the queue.",
          jobTypeLabel: "Step",
          jobStatusLabel: "Status",
          jobTimeLabel: "Scheduled for",
          extract: "Extraction",
          translate: "Translation",
          summarize: "Summary",
          viewJobs: "View all jobs",
          entries: [
            {
              title: "Sources",
              description: "Maintain RSS/Atom sources and sync cadence.",
              href: buildAdminHref(lang, "feeds"),
              icon: Rss,
            },
            {
              title: "Articles",
              description: "Review stored content and regenerate titles, bodies, or summaries.",
              href: buildAdminHref(lang, "articles"),
              icon: FileText,
            },
            {
              title: "Jobs",
              description: "Track processing steps, inspect failures, and retry.",
              href: buildAdminHref(lang, "jobs"),
              icon: Workflow,
            },
            {
              title: "Settings",
              description: "Configure model access and maintain processing prompts.",
              href: buildAdminHref(lang, "settings"),
              icon: Bot,
            },
          ] satisfies AdminEntry[],
        }
  const runDetails = decodeWorkerRunDetails(params.details)
  const runSummary =
    params.run && params.run !== "failed"
      ? `${copy.runSuccessPrefix}${params.succeeded ?? "0"}/${params.feeds ?? "0"} ${copy.runSuccessSuffix} ${params.jobs ?? "0"} ${copy.runSuccessJobsSuffix}`
      : params.run === "failed"
        ? copy.runFailed
        : null

  return (
    <AdminPageShell
      title={copy.title}
      description={copy.description}
      currentNav="/admin"
      lang={lang}
    >
      {runSummary ? (
        <div className={`rounded-[1.15rem] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:shadow-none ${runTone(params.run)}`}>
          <p>{runSummary}</p>
          {params.message ? (
            <p className="mt-1 text-xs text-muted-foreground">{params.message}</p>
          ) : null}
          {runDetails.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {runDetails.map((detail) => (
                <div
                  key={`${detail.articleId}-${detail.status}`}
                  className="rounded-[0.9rem] border border-black/5 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{detail.title}</p>
                    <span className={`text-xs ${statusTone(detail.status)}`}>
                      {detail.status === "succeeded" ? copy.succeeded : copy.failed}
                    </span>
                  </div>
                  {detail.error ? (
                    <p className="mt-1 text-xs text-muted-foreground">{detail.error}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-stone-50">
            {copy.statusTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{copy.statusBody}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <Card key={card.title} className="min-h-[104px] justify-center py-4">
              <CardContent className="grid min-h-[80px] content-center gap-2.5 px-5">
                <CardDescription className="leading-none">{card.title}</CardDescription>
                <CardTitle className="text-lg leading-none text-zinc-950 dark:text-stone-50">{card.value}</CardTitle>
                <p className="text-sm text-muted-foreground">{card.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.operationsTitle}</CardTitle>
            <CardDescription>{copy.operationsBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RunWorkerForm action={runWorkerOnceAction} lang={lang} />
            <Separator />
            <div className="grid gap-2.5 sm:grid-cols-2">
              {copy.entries.map((entry) => {
                const Icon = entry.icon

                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="group min-h-[92px] rounded-[1.15rem] border border-black/5 bg-white/68 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-emerald-900/15 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-emerald-200/20 dark:hover:bg-white/[0.065]"
                  >
                    <div className="flex h-full items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-black/6 bg-[#f7fbf8] p-1.5 text-emerald-800 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#18241e] dark:text-emerald-300 dark:shadow-none">
                            <Icon className="size-3.5" />
                          </span>
                          <span className="text-sm font-semibold text-zinc-950 dark:text-stone-100">
                            {entry.title}
                          </span>
                        </div>
                        <p className="text-sm leading-5 text-zinc-500 dark:text-stone-400">
                          {entry.description}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-800 dark:text-stone-500 dark:group-hover:text-emerald-300" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.queueTitle}</CardTitle>
            <CardDescription>{copy.queueBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {jobPreviewRows.length === 0 ? (
              <div className="rounded-[1.15rem] border border-dashed border-black/10 bg-white/60 px-4 py-5 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-sm font-medium text-zinc-950 dark:text-stone-100">
                  {copy.jobsEmptyStateTitle}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{copy.noJobs}</p>
              </div>
            ) : (
              <>
                {jobPreviewRows.map((job) => (
                  <div
                    key={job.id}
                    className={cn("flex flex-col gap-2", getAdminSubtlePanelClassName())}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {job.articleTitle}
                      </p>
                      <span
                        className={`shrink-0 whitespace-nowrap text-xs ${statusTone(job.status)}`}
                      >
                        {job.status === "succeeded"
                          ? copy.succeeded
                          : job.status === "failed"
                            ? copy.failed
                            : copy.processing}
                      </span>
                    </div>
                    <div className="grid items-end gap-3 text-xs text-muted-foreground sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[0.68rem] uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                          {copy.jobTypeLabel}
                        </span>
                        <span>
                          {job.jobType === "extract"
                            ? copy.extract
                            : job.jobType === "translate"
                              ? copy.translate
                              : copy.summarize}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[0.68rem] uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                          {copy.jobStatusLabel}
                        </span>
                        <span className={`whitespace-nowrap ${statusTone(job.status)}`}>
                          {job.status === "succeeded"
                            ? copy.succeeded
                            : job.status === "failed"
                              ? copy.failed
                              : copy.processing}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[0.68rem] uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                          {copy.jobTimeLabel}
                        </span>
                        <span>{job.runAt}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <Link
                  href={buildAdminHref(lang, "jobs")}
                  className="text-sm font-medium text-zinc-500 hover:text-emerald-800 dark:text-stone-400 dark:hover:text-emerald-300"
                >
                  {copy.viewJobs}
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <WorkerStatusPanel lang={lang} />
    </AdminPageShell>
  )
}
