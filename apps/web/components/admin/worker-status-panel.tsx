"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Clock, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { AppLang } from "@/lib/i18n"
import { ACTIVE_PIPELINE_STAGES, stageLabel } from "@/lib/pipeline-stages"

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

/** 进度阶段列表 — only active stages (no waiting/completed) */
const PIPELINE_STAGES: readonly string[] = ACTIVE_PIPELINE_STAGES

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
  const [view, setView] = useState<"running" | "queued">("running")
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

  return (
    <section className="flex flex-col gap-3">
      {/* 切换标签 */}
      <div className="flex items-center gap-1 rounded-[0.9rem] bg-black/[0.04] p-1 dark:bg-white/[0.06]">
        <button
          type="button"
          onClick={() => setView("running")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[0.7rem] px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "running"
              ? "bg-white text-zinc-950 shadow-sm dark:bg-white/10 dark:text-stone-50"
              : "text-zinc-500 hover:text-zinc-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          {lang === "zh" ? "运行中" : "Running"}
          {status.runningCount > 0 && (
            <span className="font-mono text-xs">{status.runningCount}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setView("queued")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[0.7rem] px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "queued"
              ? "bg-white text-zinc-950 shadow-sm dark:bg-white/10 dark:text-stone-50"
              : "text-zinc-500 hover:text-zinc-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          {lang === "zh" ? "排队中" : "Queued"}
          {status.queuedCount > 0 && (
            <span className="font-mono text-xs">{status.queuedCount}</span>
          )}
        </button>
      </div>

      {/* 运行中的任务 */}
      {view === "running" && status.running.length > 0 && (
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
          {status.running.map((job) => (
            <div
              key={job.id}
              className="flex flex-col gap-2.5 rounded-[1rem] border border-emerald-900/10 bg-[#f7fbf8] px-4 py-3 dark:border-emerald-200/10 dark:bg-[#121b17]"
            >
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

      {view === "running" && status.running.length === 0 && (
        <div className="rounded-[1rem] border border-dashed border-black/10 bg-white/60 px-4 py-5 text-center dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm text-muted-foreground">
            {lang === "zh" ? "当前没有运行中的任务" : "No tasks currently running"}
          </p>
        </div>
      )}

      {/* 排队中的任务 */}
      {view === "queued" && status.queued.length > 0 && (
        <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
          {status.queued.map((job) => (
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

      {view === "queued" && status.queued.length === 0 && (
        <div className="rounded-[1rem] border border-dashed border-black/10 bg-white/60 px-4 py-5 text-center dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm text-muted-foreground">
            {lang === "zh" ? "当前没有排队中的任务" : "No tasks currently queued"}
          </p>
        </div>
      )}
    </section>
  )
}
