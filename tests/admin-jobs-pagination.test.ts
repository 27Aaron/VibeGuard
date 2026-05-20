import fs from "node:fs"

import { describe, expect, it } from "vitest"

import {
  ADMIN_JOB_STAGE_FILTERS,
  ADMIN_JOB_PAGE_SIZE_OPTIONS,
  parseAdminJobListParams,
} from "../apps/web/lib/admin-job-pagination"

describe("admin job pagination", () => {
  it("defaults the admin job list to the first page with 10 rows", () => {
    const params = parseAdminJobListParams({})

    expect(params).toEqual({ page: 1, pageSize: 10, stage: "all" })
    expect(ADMIN_JOB_PAGE_SIZE_OPTIONS).toEqual([10, 20, 50])
    expect(ADMIN_JOB_STAGE_FILTERS).toEqual([
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
    ])
  })

  it("accepts supported page sizes and normalizes invalid page inputs", () => {
    expect(parseAdminJobListParams({ page: "4", pageSize: "10", stage: "translate_title" })).toEqual({
      page: 4,
      pageSize: 10,
      stage: "translate_title",
    })
    expect(parseAdminJobListParams({ page: "0", pageSize: "100", stage: "unknown" })).toEqual({
      page: 1,
      pageSize: 10,
      stage: "all",
    })
  })

  it("renders job pagination controls while preserving the status filter", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/jobs/page.tsx", "utf8")
    const table = fs.readFileSync("apps/web/components/admin/job-table.tsx", "utf8")
    const stageFilter = fs.readFileSync(
      "apps/web/components/admin/job-stage-filter-select.tsx",
      "utf8",
    )
    const selectAll = fs.readFileSync(
      "apps/web/components/admin/job-select-all-checkbox.tsx",
      "utf8",
    )

    expect(page).toContain("parseAdminJobListParams")
    expect(page).toContain("ADMIN_JOB_PAGE_SIZE_OPTIONS")
    expect(page).toContain("pageSize?: string")
    expect(page).toContain("stage?: string")
    expect(page).toContain("const stage = paginationParams.stage")
    expect(page).toContain("stage,")
    expect(page).toContain("每页展示")
    expect(page).toContain("上一页")
    expect(page).toContain("下一页")
    expect(page).toContain("buildJobsHref")
    expect(page).toContain("retrySelectedJobsAction")
    expect(page).toContain("执行选中")
    expect(page).toContain("const hasSelectableJobs = jobs.length > 0")
    expect(page).toContain("disabled={!hasSelectableJobs}")
    expect(table).toContain("JobStageFilterSelect")
    expect(table).toContain("JobSelectAllCheckbox")
    expect(table).toContain('formId="selected-jobs-form"')
    expect(table).toContain('inputName="ids"')
    expect(table).toContain("table-fixed")
    expect(table).not.toContain("筛选阶段")
    expect(stageFilter).toContain("\"use client\"")
    expect(stageFilter).toContain("router.push")
    expect(stageFilter).toContain("router.push(`/${lang}/admin/jobs?")
    expect(stageFilter).toContain("onChange")
    expect(selectAll).toContain("\"use client\"")
    expect(selectAll).toContain("indeterminate")
    expect(selectAll).toContain("querySelectorAll")
    expect(page).not.toContain("最近 100 条任务")
    expect(page).not.toContain("latest 100 jobs")
    expect(page).not.toContain("服务端完成")
  })

  it("runs selected jobs through a bounded worker batch", () => {
    const actions = fs.readFileSync("apps/web/lib/actions/jobs.ts", "utf8")

    expect(actions).toContain("processQueuedJobsByIds")
    expect(actions).toContain("MANUAL_SELECTED_JOB_BATCH_SIZE")
    expect(actions).toContain("batchSize: MANUAL_SELECTED_JOB_BATCH_SIZE")
    expect(actions).toContain("clearGeneratedContent")
  })

  it("shows checkboxes and per-row action buttons for every visible job", () => {
    const table = fs.readFileSync("apps/web/components/admin/job-table.tsx", "utf8")

    expect(table).toContain("actionLabel")
    expect(table).toContain("retryJobAction")
    expect(table).toContain('form="selected-jobs-form"')
    expect(table).toContain("cursor-pointer")
    expect(table).toContain("重新执行")
    expect(table).toContain("立即执行")
    expect(table).toContain("text-left")
    expect(table).not.toContain('disabled={job.status !== "failed"}')
    expect(table).not.toContain('className="text-xs text-muted-foreground">-</span>')
  })

  it("shows completed jobs as processing complete instead of their last technical stage", () => {
    const table = fs.readFileSync("apps/web/components/admin/job-table.tsx", "utf8")
    const stageFilter = fs.readFileSync(
      "apps/web/components/admin/job-stage-filter-select.tsx",
      "utf8",
    )

    expect(table).toContain("displayStageLabel")
    expect(table).toContain("处理完成")
    expect(table).toContain("Processing complete")
    expect(table).toContain("处理标签")
    expect(table).toContain("Generate tags")
    expect(table).toContain("相关性判断")
    expect(table).toContain("Classify relevance")
    expect(table).toContain("job.status === \"succeeded\"")
    expect(stageFilter).toContain("相关性判断")
    expect(stageFilter).toContain("Classify relevance")
    expect(stageFilter).toContain("classify_relevance")
    expect(stageFilter).toContain("处理标签")
    expect(stageFilter).toContain("Generate tags")
    expect(stageFilter).toContain("generate_tags")
    expect(stageFilter).toContain("completed")
  })

  it("keeps admin job queries paginated and filtered", () => {
    const adminData = fs.readFileSync("apps/web/lib/admin-data.ts", "utf8")

    expect(adminData).toContain("getJobRows(input")
    expect(adminData).toContain("const pageSize = input.pageSize")
    expect(adminData).toContain("VISIBLE_JOB_STATUSES")
    expect(adminData).toContain("or(visibleJobFilter")
    expect(adminData).toContain("eq(articles.status, \"filtered\")")
    expect(adminData).toContain("status === \"all\" || status === \"filtered\"")
    expect(adminData).toContain("processingJobs.pipelineStage")
    expect(adminData).toContain(".limit(pageSize)")
    expect(adminData).toContain(".offset(offset)")
    expect(adminData).toContain("totalCount")
    expect(adminData).not.toContain(".limit(100)")
  })
})
