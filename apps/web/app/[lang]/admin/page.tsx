import Link from "next/link"
import { ArrowRight, Bot, FileText, Rss, Workflow } from "lucide-react"

import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { OsvSyncButton, OsvSyncPanel } from "@/components/admin/osv-sync-panel"
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
import { getDashboardOverview } from "@/lib/admin-data"
import { resolveLang } from "@/lib/i18n"
import { decodeWorkerRunDetails } from "@/lib/worker-run"

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
  return `/${lang}/admin/${segment}`
}

type AdminHomePageProps = {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{
    run?: string
    feeds?: string
    succeeded?: string
    failed?: string
    jobs?: string
    message?: string
    details?: string
  }>
}

export default async function AdminHomePage({ params: routeParams, searchParams }: AdminHomePageProps) {
  const { lang: rawLang } = await routeParams
  const params = (await searchParams) ?? {}
  const lang = resolveLang(rawLang)
  const overviewCards = await getDashboardOverview(lang)
  const copy =
    lang === "zh"
      ? {
          title: "总览",
          description: "集中查看来源、文章、任务和模型配置的运行状态。",
          statusTitle: "运行状态",
          statusBody: "用四个指标快速判断采集、处理和模型链路是否可用。",
          operationsTitle: "常用操作",
          operationsBody: "高频入口集中在这里：抓取来源入队，或进入对应模块继续处理。",
          queueTitle: "任务执行",
          runSuccessPrefix: "本轮来源抓取已完成：",
          runSuccessSuffix: "个来源抓取成功，新任务已交给常驻 Worker。",
          runFailed: "本轮来源抓取失败，请查看任务队列里的错误信息。",
          succeeded: "已完成",
          failed: "失败",
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
            "Fetch sources into the queue or jump into the module that needs attention.",
          queueTitle: "Task execution",
          runSuccessPrefix: "Source fetch finished:",
          runSuccessSuffix: "sources succeeded. New jobs were handed to the persistent worker.",
          runFailed: "This source fetch failed. Check the job queue for the error.",
          succeeded: "Succeeded",
          failed: "Failed",
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
      ? `${copy.runSuccessPrefix}${params.succeeded ?? "0"}/${params.feeds ?? "0"} ${copy.runSuccessSuffix}`
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

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.operationsTitle}</CardTitle>
            <CardDescription>{copy.operationsBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
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
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <RunWorkerForm action={runWorkerOnceAction} lang={lang} />
              <OsvSyncButton lang={lang} />
            </div>
            <OsvSyncPanel lang={lang} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.queueTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <WorkerStatusPanel lang={lang} />
            <Link
              href={buildAdminHref(lang, "jobs")}
              className="text-sm font-medium text-zinc-500 hover:text-emerald-800 dark:text-stone-400 dark:hover:text-emerald-300"
            >
              {lang === "zh" ? "查看完整任务列表" : "View all jobs"}
            </Link>
          </CardContent>
        </Card>
      </section>
    </AdminPageShell>
  )
}
