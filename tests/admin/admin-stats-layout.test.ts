import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin stats layout", () => {
  it("uses the shared admin shell, metric cards, and table surfaces", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/stats/page.tsx", "utf8")

    expect(page).toContain("AdminPageShell")
    expect(page).toContain("Card")
    expect(page).toContain("getAdminTableSurfaceClassName")
    expect(page).toContain("TableHeader className=\"bg-white/56 dark:bg-white/[0.035]\"")
    expect(page).toContain("font-heading text-xs font-semibold uppercase")
    expect(page).not.toContain("mx-auto max-w-6xl p-6 space-y-8")
    expect(page).not.toContain("rounded-lg border")
    expect(page).not.toContain("thead className=\"bg-muted\"")
  })
})
