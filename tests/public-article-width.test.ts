import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public article page width", () => {
  it("matches the widened homepage container and gives long titles more room", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/articles/[articleId]/page.tsx", "utf8")
    const layoutTokens = fs.readFileSync("apps/web/lib/layout-tokens.ts", "utf8")

    expect(layoutTokens).toContain("max-w-[1440px]")
    expect(layoutTokens).toContain("lg:px-8")
    expect(page).toContain("max-w-5xl text-2xl font-semibold")
    expect(page).toContain("md:text-3xl")
  })
})
