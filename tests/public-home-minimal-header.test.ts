import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public homepage minimal header", () => {
  it("keeps the home screen compact while using the soft reference palette", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")
    const layoutTokens = fs.readFileSync("apps/web/lib/layout-tokens.ts", "utf8")

    expect(page).not.toContain("text.publicHeroTitle")
    expect(page).not.toContain("text.publicHeroBody")
    expect(page).not.toContain("text.publicEyebrowReadable")
    expect(page).not.toContain("text.publicReadableArticles")
    expect(page).not.toContain("text.publicEnabledSources")
    expect(layoutTokens).toContain("max-w-[1440px]")
    expect(layoutTokens).toContain("bg-[#f2f2f0]")
    expect(layoutTokens).toContain("dark:bg-[#070b0f]")
  })
})
