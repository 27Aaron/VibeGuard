import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin articles bulk actions", () => {
  it("renders a selected-articles form and bulk actions above the article table", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/articles/page.tsx", "utf8")

    expect(page).toContain("selectedArticlesAction")
    expect(page).toContain('id="selected-articles-form"')
    expect(page).toContain('name="page"')
    expect(page).toContain('name="pageSize"')
    expect(page).toContain('name="q"')
    expect(page).toContain("ArticleBulkActions")
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

  it("uses compact bulk action buttons that are disabled until articles are selected", () => {
    const button = fs.readFileSync("apps/web/components/admin/article-bulk-actions.tsx", "utf8")

    expect(button).toContain("AlertDialog")
    expect(button).toContain("RotateCcw")
    expect(button).toContain("selectedCount")
    expect(button).toContain("const disabled = selectedCount === 0")
    expect(button).toContain("disabled={disabled}")
    expect(button).toContain('form={formId}')
    expect(button).toContain('type="submit"')
    expect(button).toContain('name="intent"')
    expect(button).toContain('value="delete"')
    expect(button).toContain('value="regenerate"')
    expect(button).toContain("删除")
    expect(button).toContain("重试")
    expect(button).not.toContain("删除选中")
  })

  it("defines a server action that deletes the selected article ids and revalidates article surfaces", () => {
    const actions = fs.readFileSync("apps/web/lib/actions/articles.ts", "utf8")

    expect(actions).toContain("selectedArticlesAction")
    expect(actions).toContain("deleteSelectedArticlesAction")
    expect(actions).toMatch(/formData\s*\.\s*getAll\("ids"\)/)
    expect(actions).toContain("db.delete(articles)")
    expect(actions).toContain("inArray(articles.id, existingIds)")
    expect(actions).toContain('"/admin/articles"')
    expect(actions).toContain('"/admin/jobs"')
  })

  it("defines a server action that queues selected articles for full regeneration", () => {
    const actions = fs.readFileSync("apps/web/lib/actions/articles.ts", "utf8")

    expect(actions).toContain("regenerateSelectedArticlesAction")
    expect(actions).toContain("intent")
    expect(actions).toContain("processingJobs")
    expect(actions).toContain("JobType.EXTRACT")
    expect(actions).toContain("JobStatus.QUEUED")
    expect(actions).toContain("JobPipelineStage.WAITING")
    expect(actions).toContain("ArticleStatus.PENDING")
    expect(actions).toContain(".insert(processingJobs)")
    expect(actions).toContain("onConflictDoNothing")
    expect(actions).toContain("contentMdEn: null")
    expect(actions).toContain("summaryZh: null")
  })

  it("requeues existing extract jobs instead of relying only on inserting new jobs", () => {
    const actions = fs.readFileSync("apps/web/lib/actions/articles.ts", "utf8")

    expect(actions).toContain("existingExtractJobs")
    expect(actions).toContain("withoutExistingJobIds")
    expect(actions).toContain(".update(processingJobs)")
    expect(actions).toContain("inArray(processingJobs.id, requeuedJobIds)")
    expect(actions).toContain("startedAt: null")
    expect(actions).toContain("finishedAt: null")
    expect(actions).toContain("lastError: null")
  })
})
