export const ADMIN_JOB_PAGE_SIZE_OPTIONS = [10, 20, 50] as const
export const DEFAULT_ADMIN_JOB_PAGE_SIZE = 10
export const ADMIN_JOB_STAGE_FILTERS = [
  "all",
  "waiting",
  "fetch_source",
  "extract_content",
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

function parsePositiveInteger(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.floor(parsed)
}

function parsePageSize(value: string | null | undefined): AdminJobPageSize {
  const parsed = parsePositiveInteger(value, DEFAULT_ADMIN_JOB_PAGE_SIZE)

  return ADMIN_JOB_PAGE_SIZE_OPTIONS.includes(parsed as AdminJobPageSize)
    ? (parsed as AdminJobPageSize)
    : DEFAULT_ADMIN_JOB_PAGE_SIZE
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
    pageSize: parsePageSize(input.pageSize),
    stage: parseStage(input.stage),
  }
}
