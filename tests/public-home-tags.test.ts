import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public homepage tag filters", () => {
  it("uses a lightweight tag-only filter surface", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")
    const i18n = fs.readFileSync("apps/web/lib/i18n.ts", "utf8")

    expect(page).toContain("PublicTagFilter")
    expect(page).toContain("getPublicTags")
    expect(page).toContain("tag?: string")
    expect(page).toContain('limit: "12"')
    expect(page).not.toContain("getPublicSources")
    expect(page).not.toContain("ARTICLE_ECOSYSTEM_VALUES")
    expect(page).not.toContain("ARTICLE_RISK_CATEGORY_VALUES")
    expect(page).not.toContain("getEcosystemLabel")
    expect(page).not.toContain("getRiskCategoryLabel")
    expect(i18n).toContain("搜索标题、摘要或标签")
    expect(i18n).toContain("Search titles, summaries, or tags")
  })
})
