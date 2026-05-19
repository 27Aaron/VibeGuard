"use client"

import { useRouter } from "next/navigation"

import type { JobStageFilter, JobStatusFilter } from "@/components/admin/types"
import { ADMIN_JOB_STAGE_FILTERS } from "@/lib/admin-job-pagination"
import { getAdminFilterSelectClassName } from "@/lib/admin-layout"
import type { AppLang } from "@/lib/i18n"

function stageLabel(stage: JobStageFilter, lang: AppLang) {
  switch (stage) {
    case "all":
      return lang === "zh" ? "全部阶段" : "All stages"
    case "waiting":
      return lang === "zh" ? "等待处理" : "Waiting"
    case "fetch_source":
      return lang === "zh" ? "原文抓取" : "Fetch source"
    case "extract_content":
      return lang === "zh" ? "正文提取" : "Extract content"
    case "translate_title":
      return lang === "zh" ? "标题翻译" : "Translate title"
    case "translate_content":
      return lang === "zh" ? "正文翻译" : "Translate content"
    case "summarize_en":
      return lang === "zh" ? "英文摘要" : "English summary"
    case "summarize_zh":
      return lang === "zh" ? "中文摘要" : "Chinese summary"
    case "generate_tags":
      return lang === "zh" ? "处理标签" : "Generate tags"
    case "completed":
      return lang === "zh" ? "处理完成" : "Processing complete"
  }
}

export function JobStageFilterSelect({
  lang,
  status,
  stage,
  pageSize,
}: {
  lang: AppLang
  status: JobStatusFilter
  stage: JobStageFilter
  pageSize: number
}) {
  const router = useRouter()

  return (
    <select
      aria-label={lang === "zh" ? "当前阶段" : "Current stage"}
      className={getAdminFilterSelectClassName()}
      value={stage}
      onChange={(event) => {
        const nextStage = event.target.value as JobStageFilter
        const params = new URLSearchParams({
          lang,
          page: "1",
          pageSize: String(pageSize),
        })

        if (status !== "all") {
          params.set("status", status)
        }

        if (nextStage !== "all") {
          params.set("stage", nextStage)
        }

        router.push(`/admin/jobs?${params.toString()}`)
      }}
    >
      {ADMIN_JOB_STAGE_FILTERS.map((option) => (
        <option key={option} value={option}>
          {stageLabel(option, lang)}
        </option>
      ))}
    </select>
  )
}
