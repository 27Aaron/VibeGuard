import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public homepage card layout", () => {
  it("keeps article cards visually aligned while removing redundant footer labels", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).toContain("grid items-start gap-4")
    expect(page).toContain("group rounded-2xl border border-slate-200/75 bg-white/88 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-amber-100/25 dark:hover:shadow-none")
    expect(page).toContain("flex flex-col gap-3 rounded-2xl p-5")
    expect(page).toContain("line-clamp-3 min-h-[5.25rem] text-xl font-semibold")
    expect(page).toContain("line-clamp-3 text-sm leading-6")
    expect(page).not.toContain('className="min-h-[4.5rem]"')
    expect(page).not.toContain("text.viewArticle")
    expect(page).not.toContain("text.currentLocaleZh")
    expect(page).not.toContain("text.currentLocaleEn")
  })

  it("keeps card metadata readable under long English labels by separating badges from timestamps", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).toContain('className="flex flex-col gap-1.5"')
    expect(page).toContain('tracking-[0.18em] text-slate-400')
    expect(page).toContain("article.sourceName.toUpperCase()")
  })

  it("removes locale and read-more copy from homepage card text", () => {
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8")

    expect(copy).not.toContain("currentLocaleZh")
    expect(copy).not.toContain("currentLocaleEn")
    expect(copy).not.toContain("viewArticle")
  })
})
