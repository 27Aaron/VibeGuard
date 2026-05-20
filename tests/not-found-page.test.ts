import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("localized not-found page", () => {
  it("uses the route language context for /[lang] 404 pages", () => {
    const notFound = fs.readFileSync("apps/web/app/[lang]/not-found.tsx", "utf8")
    const requestLang = fs.readFileSync("apps/web/lib/request-lang.ts", "utf8")
    const proxy = fs.readFileSync("apps/web/proxy.ts", "utf8")

    expect(notFound).toContain("getRequestLang()")
    expect(requestLang).toContain('"x-vibeguard-lang"')
    expect(proxy).toContain('"x-vibeguard-lang"')
    expect(proxy).toContain('"us"')
    expect(proxy).toContain('return redirectToLangPath(request, "en", segments.slice(1))')
    expect(notFound).not.toContain("cookies()")
    expect(notFound).not.toContain("useLang()")
  })

  it("keeps the 404 surface bilingual and theme-aware", () => {
    const content = fs.readFileSync("apps/web/components/not-found-content.tsx", "utf8")
    const rootLayout = fs.readFileSync("apps/web/app/layout.tsx", "utf8")

    expect(content).toContain("Page not found")
    expect(content).toContain("页面没有找到")
    expect(content).toContain("<ThemeToggle />")
    expect(content).toContain("dark:")
    expect(rootLayout).toContain("THEME_BOOTSTRAP_SCRIPT")
    expect(rootLayout).toContain("<Script")
    expect(rootLayout).not.toContain("<script")
    expect(rootLayout).not.toContain("theme-init.js")
  })
})
