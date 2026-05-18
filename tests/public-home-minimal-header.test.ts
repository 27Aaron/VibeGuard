import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public homepage minimal header", () => {
  it("keeps the home screen compact while using the soft reference palette", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).not.toContain("text.publicHeroTitle")
    expect(page).not.toContain("text.publicHeroBody")
    expect(page).not.toContain("text.publicEyebrowReadable")
    expect(page).not.toContain("text.publicReadableArticles")
    expect(page).not.toContain("text.publicEnabledSources")
    expect(page).toContain("max-w-[1440px]")
    expect(page).toContain("bg-[#f2f2f0]")
    expect(page).toContain("dark:bg-[#070b0f]")
  })
})
