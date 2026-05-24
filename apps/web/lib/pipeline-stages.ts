import type { AppLang } from "@/lib/i18n"

/**
 * 流水线处理阶段，按执行顺序排列。
 * 覆盖从等待（waiting）到完成（completed）的完整生命周期。
 */
export const PIPELINE_STAGES = [
  "waiting",
  "fetch_source",
  "extract_content",
  "classify_relevance",
  "translate_title",
  "translate_content",
  "summarize_en",
  "summarize_zh",
  "generate_tags",
  "completed",
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/**
 * 活跃的流水线处理阶段（排除 waiting 和 completed）。
 * 适用于只需要计数实际处理步骤的进度指示器。
 */
export const ACTIVE_PIPELINE_STAGES = PIPELINE_STAGES.filter(
  (s) => s !== "waiting" && s !== "completed",
)

/**
 * 返回流水线阶段或筛选值的本地化可读标签。
 */
export function stageLabel(stage: string, lang: AppLang): string {
  switch (stage) {
    case "all":
      return lang === "zh" ? "全部阶段" : "All stages"
    case "waiting":
      return lang === "zh" ? "等待处理" : "Waiting"
    case "fetch_source":
      return lang === "zh" ? "原文抓取" : "Fetch source"
    case "extract_content":
      return lang === "zh" ? "正文提取" : "Extract content"
    case "classify_relevance":
      return lang === "zh" ? "相关性判断" : "Classify relevance"
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
    default:
      return stage
  }
}
