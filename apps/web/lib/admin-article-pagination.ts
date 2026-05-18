export const ADMIN_ARTICLE_PAGE_SIZE_OPTIONS = [10, 20, 50] as const
export const DEFAULT_ADMIN_ARTICLE_PAGE_SIZE = 10

export type AdminArticlePageSize = (typeof ADMIN_ARTICLE_PAGE_SIZE_OPTIONS)[number]

export type AdminArticleListParams = {
  page: number
  pageSize: AdminArticlePageSize
}

type RawAdminArticleListParams = {
  page?: string | null
  pageSize?: string | null
}

function parsePositiveInteger(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.floor(parsed)
}

function parsePageSize(value: string | null | undefined): AdminArticlePageSize {
  const parsed = parsePositiveInteger(value, DEFAULT_ADMIN_ARTICLE_PAGE_SIZE)

  return ADMIN_ARTICLE_PAGE_SIZE_OPTIONS.includes(parsed as AdminArticlePageSize)
    ? (parsed as AdminArticlePageSize)
    : DEFAULT_ADMIN_ARTICLE_PAGE_SIZE
}

export function parseAdminArticleListParams(
  input: RawAdminArticleListParams,
): AdminArticleListParams {
  return {
    page: parsePositiveInteger(input.page, 1),
    pageSize: parsePageSize(input.pageSize),
  }
}
