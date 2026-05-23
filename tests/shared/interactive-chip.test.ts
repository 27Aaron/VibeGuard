import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("interactive chip styles", () => {
  it("shares one dense chip style between public filters and admin navigation", () => {
    const helper = fs.readFileSync("apps/web/lib/interactive-chip.ts", "utf8")
    const publicTagFilter = fs.readFileSync("apps/web/components/public-tag-filter.tsx", "utf8")
    const adminNav = fs.readFileSync("apps/web/components/admin/admin-nav.tsx", "utf8")

    expect(helper).toContain("rounded-full")
    expect(helper).toContain("h-8")
    expect(helper).toContain("border-black/8")
    expect(helper).toContain("dark:border-white/8")
    expect(helper).toContain("border-emerald-900/18 bg-[#dfe9e2]")
    expect(helper).toContain("text-[0.78rem]")
    expect(publicTagFilter).toContain("getInteractiveChipClassName(item.active)")
    expect(adminNav).toContain("inline-flex h-8 min-w-0 items-center rounded-full")
    expect(adminNav).toContain("border-emerald-900/18 bg-[#dfe9e2]")
  })
})
