import { describe, expect, it } from "vitest"

import { getPublicArticleSummaryContainerClass } from "../apps/web/lib/article-layout"
import fs from "node:fs"

describe("public article layout helpers", () => {
  it("keeps the summary section full width instead of clamping it to a narrow column", () => {
    expect(getPublicArticleSummaryContainerClass()).toBe("w-full")
  })

  it("groups summary, source actions, and tags into a dedicated overview panel before the body", () => {
    const page = fs.readFileSync("apps/web/app/articles/[articleId]/page.tsx", "utf8")

    expect(page).toContain("rounded-2xl border border-slate-200/75 bg-white/80")
    expect(page).toContain("summaryPanelTitle")
    expect(page).toContain("summaryPanelTags")
  })
})
