import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public homepage card layout", () => {
  it("adds a soft status bar with future API, Skill, MCP, and RSS entry points", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).toContain("futureSurfaceLinks")
    expect(page).toContain("Live feed")
    expect(page).toContain("API")
    expect(page).toContain("Skill")
    expect(page).toContain("MCP")
    expect(page).toContain("RSS")
    expect(page).toContain("backdrop-blur-2xl")
    expect(page).toContain("md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")
    expect(page).toContain("md:justify-self-center")
    expect(page.indexOf('{ label: "API"')).toBeLessThan(page.indexOf('{ label: "MCP"'))
    expect(page.indexOf('{ label: "MCP"')).toBeLessThan(page.indexOf('{ label: "RSS"'))
    expect(page.indexOf('{ label: "RSS"')).toBeLessThan(page.indexOf('{ label: "Skill"'))
    expect(page).toContain("inline-flex h-8 min-w-0 items-center rounded-full border border-black/8 bg-[#eef2f7] p-[2px]")
    expect(page).toContain("inline-flex h-[26px] items-center gap-1.5 rounded-full border border-black/8 bg-white px-2.5")
    expect(page).toContain("dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100")
    expect(page).toContain("item.active &&")
    expect(page).toContain("border-emerald-900/18 bg-[#dfe9e2] text-emerald-950")
    expect(page).toContain("dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100")
    expect(page).toContain("border-emerald-900/12 bg-[#f7fbf8] text-emerald-950")
    expect(page).toContain("item.active && \"text-emerald-800 dark:text-emerald-300\"")
    expect(page).not.toContain("flex h-[26px] w-[26px] items-center justify-center")
    expect(page).not.toContain('sm:inline dark:text-emerald-700')
    expect(page).not.toContain('sm:inline dark:text-zinc-500')
  })

  it("keeps the first screen focused on search and the article stream", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).toContain("把安全新闻翻译成：我的项目有没有中招")
    expect(page).toContain("heroStatusCards")
    expect(page).toContain("rounded-[2rem]")
    expect(page).not.toContain("customer logos")
    expect(page).not.toContain("Talk to an engineer")
  })

  it("keeps article cards visually aligned while removing redundant footer labels", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).toContain("grid items-start gap-5")
    expect(page).toContain("group rounded-[1.65rem] border border-black/5 bg-white/50 p-1.5")
    expect(page).toContain("flex flex-col gap-3 rounded-[1.25rem] bg-[#fcfcfa]/92 p-5")
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
    expect(page).toContain('tracking-[0.18em] text-zinc-400')
    expect(page).toContain("article.sourceName.toUpperCase()")
  })

  it("removes locale and read-more copy from homepage card text", () => {
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8")

    expect(copy).not.toContain("currentLocaleZh")
    expect(copy).not.toContain("currentLocaleEn")
    expect(copy).not.toContain("viewArticle")
  })
})
