import { describe, expect, it } from "vitest"

import { getPublicArticleSummaryContainerClass } from "../apps/web/lib/article-layout"
import fs from "node:fs"

describe("public article layout helpers", () => {
  it("keeps the summary section full width instead of clamping it to a narrow column", () => {
    expect(getPublicArticleSummaryContainerClass()).toBe("w-full")
  })

  it("groups summary, source actions, and tags into a dedicated overview panel before the body", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/articles/[articleId]/page.tsx", "utf8")

    expect(page).toContain("lg:grid-cols-[minmax(0,1fr)_390px]")
    expect(page).toContain("lg:sticky lg:top-[102px]")
    expect(page).not.toContain("lg:-mt-")
    expect(page).toContain("summaryPanelTitle")
    expect(page).toContain("summaryPanelTags")
  })
})
