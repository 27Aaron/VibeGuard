"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Clock, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { AppLang } from "@/lib/i18n"

type RunningJob = {
  id: string
  articleTitle: string
  sourceName: string
  jobType: string
  pipelineStage: string
  attempt: number
  maxAttempts: number
  startedAt: string | null
  elapsed: number | null
}

type QueuedJob = {
  id: string
  articleTitle: string
  sourceName: string
  jobType: string
  attempt: number
  maxAttempts: number
}

type WorkerStatus = {
  running: RunningJob[]
  queued: QueuedJob[]
  runningCount: number
  queuedCount: number
  succeededCount: number
  failedCount: number
  totalCount: number
}

function stageLabel(stage: string, lang: AppLang) {
  const labels: Record<string, { zh: string; en: string }> = {
    waiting: { zh: "等待中", en: "Waiting" },
    fetch_source: { zh: "抓取原文", en: "Fetching" },
    extract_content: { zh: "提取正文", en: "Extracting" },
    translate_title: { zh: "翻译标题", en: "Translating title" },
    translate_content: { zh: "翻译正文", en: "Translating content" },
    summarize_en: { zh: "英文摘要", en: "EN summary" },
    summarize_zh: { zh: "中文摘要", en: "ZH summary" },
    generate_tags: { zh: "生成标签", en: "Tags" },
    completed: { zh: "已完成", en: "Completed" },
  }
  return labels[stage]?.[lang] ?? stage
}

function jobTypeLabel(type: string, lang: AppLang) {
  const labels: Record<string, { zh: string; en: string }> = {
    extract: { zh: "提取", en: "Extract" },
    translate: { zh: "翻译", en: "Translate" },
    summarize: { zh: "摘要", en: "Summarize" },
  }
  return labels[type]?.[lang] ?? type
}

function formatElapsed(seconds: number | null) {
  if (seconds === null) return "--"
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}m${sec}s`
}

/** 进度阶段列表 */
const PIPELINE_STAGES = [
  "fetch_source",
  "extract_content",
  "translate_title",
  "translate_content",
  "summarize_en",
  "summarize_zh",
  "generate_tags",
]

function stagePercent(stage: string): number {
  const idx = PIPELINE_STAGES.indexOf(stage)
  if (idx < 0) return 0
  return Math.round(((idx + 1) / PIPELINE_STAGES.length) * 100)
}

/** 单条任务的分步圆点进度 */
function TaskStepDots({ stage }: { stage: string }) {
  const currentIdx = PIPELINE_STAGES.indexOf(stage)

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STAGES.map((s, i) => (
        <div
          key={s}
          className={`size-1.5 rounded-full transition-colors duration-300 ${
            i < currentIdx
              ? "bg-emerald-500"
              : i === currentIdx
                ? "bg-emerald-400 animate-pulse"
                : "bg-zinc-200 dark:bg-zinc-700"
          }`}
        />
      ))}
    </div>
  )
}


export function WorkerStatusPanel({ lang }: { lang: AppLang }) {
  const [status, setStatus] = useState<WorkerStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/worker-status", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    timerRef.current = setInterval(fetchStatus, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchStatus])

  if (!status) return null

  const isActive = status.totalCount > 0
  if (!isActive) return null

  const visibleRunning = expanded ? status.running : status.running.slice(0, 5)
  const visibleQueued = expanded ? status.queued : status.queued.slice(0, 5)
  const hasMoreRunning = status.running.length > 5
  const hasMoreQueued = status.queued.length > 5
  const hasMore = hasMoreRunning || hasMoreQueued

  return (
    <section className="flex flex-col gap-3">
      {/* 标题栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-stone-50">
          {lang === "zh" ? "任务执行中" : "Tasks Running"}
        </h2>
        <div className="flex items-center gap-2">
          {status.runningCount > 0 && (
            <Badge variant="secondary" className="font-mono">
              {status.runningCount} {lang === "zh" ? "运行中" : "running"}
            </Badge>
          )}
          {status.queuedCount > 0 && (
            <Badge variant="outline" className="font-mono">
              {status.queuedCount} {lang === "zh" ? "排队中" : "queued"}
            </Badge>
          )}
          {status.succeededCount > 0 && (
            <Badge variant="secondary" className="bg-emerald-100 font-mono text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              {status.succeededCount} {lang === "zh" ? "已完成" : "done"}
            </Badge>
          )}
          {status.failedCount > 0 && (
            <Badge variant="destructive" className="font-mono">
              {status.failedCount} {lang === "zh" ? "失败" : "failed"}
            </Badge>
          )}
        </div>
      </div>

      {/* 运行中的任务 */}
      {visibleRunning.length > 0 && (
        <div className="flex flex-col gap-2">
          {visibleRunning.map((job) => (
            <div
              key={job.id}
              className="flex flex-col gap-2.5 rounded-[1rem] border border-emerald-900/10 bg-[#f7fbf8] px-4 py-3 dark:border-emerald-200/10 dark:bg-[#121b17]"
            >
              {/* 头部：标题 + 百分比 + 耗时 */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-zinc-950 dark:text-stone-100">
                      {job.articleTitle}
                    </p>
                    <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {jobTypeLabel(job.jobType, lang)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {job.sourceName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {stagePercent(job.pipelineStage)}%
                  </span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                    <span className="font-mono text-xs">
                      {formatElapsed(job.elapsed)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 分步圆点 + 进度条 + 当前阶段 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <TaskStepDots stage={job.pipelineStage} />
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    {stageLabel(job.pipelineStage, lang)}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${stagePercent(job.pipelineStage)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 排队中的任务 */}
      {visibleQueued.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {visibleRunning.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground">
              {lang === "zh" ? "排队中" : "Queued"}
            </p>
          )}
          {visibleQueued.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-3 rounded-lg border border-black/5 bg-white/40 px-3 py-2 dark:border-white/5 dark:bg-white/[0.02]"
            >
              <Clock className="size-3.5 shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-zinc-800 dark:text-stone-200">
                  {job.articleTitle}
                </p>
              </div>
              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {jobTypeLabel(job.jobType, lang)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 展开/收起 */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              {lang === "zh" ? "收起" : "Collapse"}
              <ChevronUp className="size-3.5" />
            </>
          ) : (
            <>
              {lang === "zh"
                ? `查看全部 ${status.totalCount} 个任务`
                : `Show all ${status.totalCount} tasks`}
              <ChevronDown className="size-3.5" />
            </>
          )}
        </button>
      )}
    </section>
  )
}
