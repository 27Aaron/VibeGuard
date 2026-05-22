import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin OSV sync panel", () => {
  it("renders the OsvSyncPanel on the admin home page", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/page.tsx", "utf8")

    expect(page).toContain("OsvSyncPanel")
    expect(page).toContain('lang={lang}')
  })

  it("provides a sync button with bilingual labels", () => {
    const component = fs.readFileSync(
      "apps/web/components/admin/osv-sync-panel.tsx",
      "utf8",
    )

    expect(component).toContain("同步漏洞库")
    expect(component).toContain("Sync Vulnerability DB")
    expect(component).toContain("同步中…")
    expect(component).toContain("Syncing…")
  })

  it("displays ecosystem status with bilingual labels", () => {
    const component = fs.readFileSync(
      "apps/web/components/admin/osv-sync-panel.tsx",
      "utf8",
    )

    expect(component).toContain("ecosystemLabel")
    expect(component).toContain("statusBadge")
    expect(component).toContain("已导入")
    expect(component).toContain("Imported")
    expect(component).toContain("暂无同步记录")
    expect(component).toContain("No sync records yet")
  })

  it("renders all four ecosystems with proper labels", () => {
    const component = fs.readFileSync(
      "apps/web/components/admin/osv-sync-panel.tsx",
      "utf8",
    )

    expect(component).toContain('case "npm"')
    expect(component).toContain('case "pypi"')
    expect(component).toContain('case "go"')
    expect(component).toContain('case "crates-io"')
    expect(component).toContain("PyPI")
    expect(component).toContain("crates.io")
  })

  it("shows status badges for running, success, failed, and idle states", () => {
    const component = fs.readFileSync(
      "apps/web/components/admin/osv-sync-panel.tsx",
      "utf8",
    )

    expect(component).toContain('case "running"')
    expect(component).toContain('case "success"')
    expect(component).toContain('case "failed"')
    expect(component).toContain("同步中")
    expect(component).toContain("正常")
    expect(component).toContain("失败")
    expect(component).toContain("待同步")
  })
})

describe("OSV sync API route", () => {
  it("exposes GET and POST handlers for the admin OSV sync endpoint", () => {
    const route = fs.readFileSync(
      "apps/web/app/api/admin/osv-sync/route.ts",
      "utf8",
    )

    expect(route).toContain("export async function GET()")
    expect(route).toContain("export async function POST()")
    expect(route).toContain("syncAllOsvEcosystems")
    expect(route).toContain("securitySyncState")
  })

  it("returns ecosystem status fields from the database", () => {
    const route = fs.readFileSync(
      "apps/web/app/api/admin/osv-sync/route.ts",
      "utf8",
    )

    expect(route).toContain("ecosystem")
    expect(route).toContain("status")
    expect(route).toContain("lastSuccessAt")
    expect(route).toContain("lastError")
    expect(route).toContain("recordsImported")
    expect(route).toContain("recordsFailed")
  })

  it("handles sync failures with error responses", () => {
    const route = fs.readFileSync(
      "apps/web/app/api/admin/osv-sync/route.ts",
      "utf8",
    )

    expect(route).toContain("ok: false")
    expect(route).toContain("status: 500")
  })
})
