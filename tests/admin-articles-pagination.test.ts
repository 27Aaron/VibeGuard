import fs from "node:fs"

import { describe, expect, it } from "vitest"

import {
  ADMIN_ARTICLE_PAGE_SIZE_OPTIONS,
  parseAdminArticleListParams,
} from "../apps/web/lib/admin-article-pagination"

describe("admin article pagination", () => {
  it("defaults the admin article list to the first page with 10 rows", () => {
    const params = parseAdminArticleListParams({})

    expect(params).toEqual({ page: 1, pageSize: 10 })
    expect(ADMIN_ARTICLE_PAGE_SIZE_OPTIONS).toEqual([10, 20, 50])
  })

  it("accepts supported page sizes and normalizes invalid page inputs", () => {
    expect(parseAdminArticleListParams({ page: "3", pageSize: "50" })).toEqual({
      page: 3,
      pageSize: 50,
    })
    expect(parseAdminArticleListParams({ page: "-2", pageSize: "999" })).toEqual({
      page: 1,
      pageSize: 10,
    })
  })

  it("renders pagination controls on the admin articles page", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/articles/page.tsx", "utf8")

    expect(page).toContain("parseAdminArticleListParams")
    expect(page).toContain("ADMIN_ARTICLE_PAGE_SIZE_OPTIONS")
    expect(page).toContain("pageSize?: string")
    expect(page).toContain("每页展示")
    expect(page).toContain("上一页")
    expect(page).toContain("下一页")
    expect(page).toContain("buildArticlesHref")
    expect(page).not.toContain("分页在服务端完成")
    expect(page).not.toContain("Pagination is server-side")
  })

  it("keeps admin article list queries lightweight and paginated", () => {
    const adminData = fs.readFileSync("apps/web/lib/admin-data.ts", "utf8")

    expect(adminData).toContain("getArticleRows(input")
    expect(adminData).toContain(".select({")
    expect(adminData).toContain("id: articles.id")
    expect(adminData).toContain("titleEn: articles.titleEn")
    expect(adminData).toContain("titleZh: articles.titleZh")
    expect(adminData).toContain(".limit(pageSize)")
    expect(adminData).toContain(".offset(offset)")
    expect(adminData).not.toContain(".limit(50)")
  })

  it("pads the admin article table so rows are easier to scan", () => {
    const table = fs.readFileSync("apps/web/components/admin/article-table.tsx", "utf8")
    const layoutTokens = fs.readFileSync("apps/web/lib/layout-tokens.ts", "utf8")

    expect(table).toContain("getAdminTableSurfaceClassName")
    expect(layoutTokens).toContain("overflow-hidden rounded-[1.25rem] border border-black/5")
    expect(table).toContain('TableHeader className="bg-white/56 dark:bg-white/[0.035]"')
    expect(table).toContain("<TableHead className=\"px-4\"")
    expect(table).toContain("max-w-[420px] px-4 py-3")
  })
})
