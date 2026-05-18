import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public homepage minimal header", () => {
  it("removes the large hero and stats blocks in favor of a filter-first top area", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).not.toContain("text.publicHeroTitle")
    expect(page).not.toContain("text.publicHeroBody")
    expect(page).not.toContain("text.publicReadableArticles")
    expect(page).not.toContain("text.publicEnabledSources")
    expect(page).toContain("max-w-[1380px]")
    expect(page).toContain("bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_56%,#eef2f7_100%)]")
  })
})
