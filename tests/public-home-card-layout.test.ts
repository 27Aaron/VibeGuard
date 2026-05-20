import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public homepage card layout", () => {
  it("adds a soft status bar with future API, Skill, MCP, and RSS entry points", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")
    const publicHeader = fs.readFileSync("apps/web/components/public-header.tsx", "utf8")

    expect(page).toContain("<PublicHeader")
    expect(publicHeader).toContain("futureSurfaceLinks")
    expect(publicHeader).toContain("Live feed")
    expect(publicHeader).toContain("flex size-8 shrink-0")
    expect(publicHeader).toContain("bg-[#e9f2ec] text-emerald-950")
    expect(publicHeader).toContain("text-[0.58rem] font-medium uppercase leading-none tracking-[0.12em]")
    expect(publicHeader).toContain("API")
    expect(publicHeader).toContain("Skill")
    expect(publicHeader).toContain("MCP")
    expect(publicHeader).toContain("RSS")
    expect(publicHeader).toContain("backdrop-blur-2xl")
    expect(publicHeader).toContain("md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")
    expect(publicHeader).toContain("md:justify-self-center")
    expect(publicHeader.indexOf('{ label: "API"')).toBeLessThan(publicHeader.indexOf('{ label: "MCP"'))
    expect(publicHeader.indexOf('{ label: "MCP"')).toBeLessThan(publicHeader.indexOf('{ label: "RSS"'))
    expect(publicHeader.indexOf('{ label: "RSS"')).toBeLessThan(publicHeader.indexOf('{ label: "Skill"'))
    expect(publicHeader).toContain("inline-flex h-8 min-w-0 items-center rounded-full border border-black/8 bg-[#eef2f7] p-[2px]")
    expect(publicHeader).toContain("inline-flex h-[26px] items-center gap-1.5 rounded-full border border-black/8 bg-white px-2.5")
    expect(publicHeader).toContain("dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100")
    expect(publicHeader).toContain("item.active &&")
    expect(publicHeader).toContain("border-emerald-900/18 bg-[#dfe9e2] text-emerald-950")
    expect(publicHeader).toContain("dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100")
    expect(publicHeader).toContain("border-emerald-900/12 bg-[#f7fbf8] text-emerald-950")
    expect(publicHeader).toContain("item.active && \"text-emerald-800 dark:text-emerald-300\"")
    expect(publicHeader).not.toContain("flex h-[26px] w-[26px] items-center justify-center")
    expect(publicHeader).not.toContain('sm:inline dark:text-emerald-700')
    expect(publicHeader).not.toContain('sm:inline dark:text-zinc-500')
  })

  it("keeps the first screen focused on search and the article stream", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8")

    expect(page).toContain('type="search"')
    expect(page).toContain("PublicTagFilter")
    expect(page).toContain("feed.meta.totalCount")
    expect(page).toContain("tagCounts.length")
    expect(page).toContain("text.publicEyebrowLive")
    expect(copy).toContain('publicEyebrowLive: "风险信号"')
    expect(copy).toContain('publicEyebrowLive: "Risk signals"')
    expect(page).toContain("dark:bg-emerald-300/10 dark:text-emerald-100")
    expect(page).not.toContain("bg-zinc-950 text-stone-50")
    expect(page).not.toContain("dark:bg-stone-100 dark:text-zinc-950")
    expect(page).toContain("inline-flex h-7 items-center gap-2")
    expect(page).toContain("text-xs font-medium tracking-normal")
    expect(page).not.toContain("publicEyebrowBilingual")
    expect(page).not.toContain("heroStatusCards")
    expect(page).not.toContain("Signal console")
    expect(page).not.toContain("Vibe Coding Guardrail")
    expect(page).not.toContain("把安全新闻翻译成：我的项目有没有中招")
    expect(page).not.toContain("publicEyebrowReadable")
    expect(page).not.toContain("篇可读文章")
    expect(page).not.toContain("readable articles`")
    expect(page).toContain("rounded-[2rem]")
    expect(page).not.toContain("customer logos")
    expect(page).not.toContain("Talk to an engineer")
  })

  it("keeps article cards visually aligned while removing redundant footer labels", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")
    const layoutTokens = fs.readFileSync("apps/web/lib/layout-tokens.ts", "utf8")

    expect(page).toContain("grid items-start gap-5")
    expect(page).toContain('className={cn("group", getCardSurfaceClassName())}')
    expect(layoutTokens).toContain("rounded-[1.65rem] border border-black/5 bg-white/50 p-1.5")
    expect(page).toContain("flex flex-col gap-3 rounded-[1.25rem] bg-[#fcfcfa]/92 p-5")
    expect(page).toContain("line-clamp-1 text-base font-semibold")
    expect(page).toContain("line-clamp-3 text-sm leading-6")
    expect(page).not.toContain('className="min-h-[4.5rem]"')
    expect(page).not.toContain("text.viewArticle")
    expect(page).not.toContain("text.currentLocaleZh")
    expect(page).not.toContain("text.currentLocaleEn")
  })

  it("keeps card metadata readable under long English labels by separating badges from timestamps", () => {
    const page = fs.readFileSync("apps/web/app/page.tsx", "utf8")

    expect(page).toContain('className="flex items-center justify-between"')
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
