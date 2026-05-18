import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public homepage cards", () => {
  it("keeps the article card clickable without forcing equal-height whitespace", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).toContain('className="group rounded-2xl border border-slate-200/75 bg-white/88 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-amber-100/25 dark:hover:shadow-none"')
    expect(page).toContain('className="flex flex-col gap-3 rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"')
    expect(page).toContain("group-hover:text-amber-50")
    expect(page).not.toContain("flex h-full flex-col gap-4")
    expect(page).not.toContain("{text.viewArticle}")
    expect(page).not.toContain('className="font-medium text-amber-100 transition-colors hover:text-amber-50"')
  })
})
