import { parsePositiveInteger, parsePageSize } from "./parse"

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

export function parseAdminArticleListParams(
  input: RawAdminArticleListParams,
): AdminArticleListParams {
  return {
    page: parsePositiveInteger(input.page, 1),
    pageSize: parsePageSize(input.pageSize, ADMIN_ARTICLE_PAGE_SIZE_OPTIONS, DEFAULT_ADMIN_ARTICLE_PAGE_SIZE),
  }
}
