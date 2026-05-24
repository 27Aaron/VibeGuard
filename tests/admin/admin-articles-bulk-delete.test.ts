import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin articles bulk delete", () => {
  it("renders a selected-articles form and bulk delete action above the article table", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/articles/page.tsx", "utf8")

    expect(page).toContain("deleteSelectedArticlesAction")
    expect(page).toContain('id="selected-articles-form"')
    expect(page).toContain('name="page"')
    expect(page).toContain('name="pageSize"')
    expect(page).toContain('name="q"')
    expect(page).toContain("ArticleBulkDeleteButton")
  })

  it("binds row checkboxes and select-all to the selected-articles form", () => {
    const table = fs.readFileSync("apps/web/components/admin/article-table.tsx", "utf8")

    expect(table).toContain("AdminSelectAllCheckbox")
    expect(table).toContain('formId="selected-articles-form"')
    expect(table).toContain('inputName="ids"')
    expect(table).toContain('form="selected-articles-form"')
    expect(table).toContain('name="ids"')
    expect(table).toContain('value={article.id}')
  })

  it("uses a confirmation dialog that is disabled until articles are selected", () => {
    const button = fs.readFileSync("apps/web/components/admin/article-bulk-delete-button.tsx", "utf8")

    expect(button).toContain("AlertDialog")
    expect(button).toContain("selectedCount")
    expect(button).toContain("disabled={selectedCount === 0}")
    expect(button).toContain('form={formId}')
    expect(button).toContain('type="submit"')
    expect(button).toContain("删除选中")
  })

  it("defines a server action that deletes the selected article ids and revalidates article surfaces", () => {
    const actions = fs.readFileSync("apps/web/lib/actions/articles.ts", "utf8")

    expect(actions).toContain("deleteSelectedArticlesAction")
    expect(actions).toMatch(/formData\s*\.\s*getAll\("ids"\)/)
    expect(actions).toContain("db.delete(articles)")
    expect(actions).toContain("inArray(articles.id, existingIds)")
    expect(actions).toContain('"/admin/articles"')
    expect(actions).toContain('"/admin/jobs"')
  })
})
