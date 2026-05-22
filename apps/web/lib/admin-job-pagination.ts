import { parsePositiveInteger, parsePageSize } from "./parse"

export const ADMIN_JOB_PAGE_SIZE_OPTIONS = [10, 20, 50] as const
export const DEFAULT_ADMIN_JOB_PAGE_SIZE = 10
export const ADMIN_JOB_STAGE_FILTERS = [
  "all",
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

export type AdminJobPageSize = (typeof ADMIN_JOB_PAGE_SIZE_OPTIONS)[number]
export type AdminJobStageFilter = (typeof ADMIN_JOB_STAGE_FILTERS)[number]

export type AdminJobListParams = {
  page: number
  pageSize: AdminJobPageSize
  stage: AdminJobStageFilter
}

type RawAdminJobListParams = {
  page?: string | null
  pageSize?: string | null
  stage?: string | null
}

function parseStage(value: string | null | undefined): AdminJobStageFilter {
  return ADMIN_JOB_STAGE_FILTERS.includes(value as AdminJobStageFilter)
    ? (value as AdminJobStageFilter)
    : "all"
}

export function parseAdminJobListParams(
  input: RawAdminJobListParams,
): AdminJobListParams {
  return {
    page: parsePositiveInteger(input.page, 1),
    pageSize: parsePageSize(input.pageSize, ADMIN_JOB_PAGE_SIZE_OPTIONS, DEFAULT_ADMIN_JOB_PAGE_SIZE),
    stage: parseStage(input.stage),
  }
}
