import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin article detail layout", () => {
  it("uses the polished admin detail layout instead of the old single-card stack", () => {
    const file = fs.readFileSync("apps/web/app/[lang]/admin/articles/[articleId]/page.tsx", "utf8")

    expect(file).toContain("lg:grid-cols-[minmax(0,1fr)_360px]")
    expect(file).toContain("lg:sticky lg:top-32")
    expect(file).toContain("getInteractiveChipClassName")
    expect(file).toContain("重新处理")
    expect(file).toContain("来源信息")
    expect(file).toContain("MarkdownRenderer")
  })

  it("gives admin markdown the same light and dark surface language", () => {
    const file = fs.readFileSync("apps/web/components/content/markdown-renderer.tsx", "utf8")

    expect(file).toContain('admin: {')
    expect(file).toContain("text-zinc-800 dark:text-stone-200")
    expect(file).toContain("bg-[#eef2f7]")
    expect(file).toContain("dark:bg-[#0b1117]")
  })
})
