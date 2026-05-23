import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin feeds layout", () => {
  it("presents the create-feed enabled option as a balanced setting row", () => {
    const form = fs.readFileSync("apps/web/components/admin/create-feed-form.tsx", "utf8")

    expect(form).toContain("justify-between gap-4")
    expect(form).toContain("创建后立即启用")
    expect(form).toContain("创建后会参与后续 Worker 抓取")
    expect(form).toContain("Enable after creation")
    expect(form).toContain("The worker can fetch this source after it is saved.")
    expect(form).toContain("h-4 w-4 shrink-0 rounded border-black/20 accent-emerald-800")
    expect(form).not.toContain("flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm")
  })

  it("gives configured sources table a padded surface instead of hugging the card edge", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/feeds/page.tsx", "utf8")
    const table = fs.readFileSync("apps/web/components/admin/feed-table.tsx", "utf8")
    const layoutTokens = fs.readFileSync("apps/web/lib/layout-tokens.ts", "utf8")

    expect(page).toContain('<CardContent className="px-6 pb-5">')
    expect(table).toContain("getAdminTableSurfaceClassName")
    expect(layoutTokens).toContain("overflow-hidden rounded-[1.25rem] border border-black/5")
    expect(table).toContain('TableHeader className="bg-white/56 dark:bg-white/[0.035]"')
    expect(table).toContain("<TableHead className=\"px-4\"")
    expect(table).toContain("<TableCell className=\"px-4 py-3 align-middle font-medium\"")
    expect(table).not.toContain("<CardContent>\n          <FeedTable")
  })
})
