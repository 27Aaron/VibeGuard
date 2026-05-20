import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public article icon links", () => {
  it("uses icon-plus-label affordances for back navigation and source links", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/articles/[articleId]/page.tsx", "utf8")

    expect(page).toContain("ChevronLeft")
    expect(page).toContain("ExternalLink")
    expect(page).toContain("{text.backToFeed}")
    expect(page).toContain("{text.readSource}")
    expect(page).toContain("inline-flex items-center gap-2")
  })
})
