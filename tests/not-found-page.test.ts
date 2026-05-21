import fs from "node:fs"

import { describe, expect, it } from "vitest"

import { proxy } from "../apps/web/proxy"

type ProxyRequest = Parameters<typeof proxy>[0]
type TestNextUrl = URL & { clone: () => TestNextUrl }

function createNextUrl(pathname: string): TestNextUrl {
  const url = new URL(`http://127.0.0.1:3000${pathname}`) as TestNextUrl
  url.clone = () => createNextUrl(`${url.pathname}${url.search}`)
  return url
}

function createProxyRequest(pathname: string, cookie: string): ProxyRequest {
  return {
    headers: new Headers({
      cookie,
    }),
    nextUrl: createNextUrl(pathname),
  } as ProxyRequest
}

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

  it("preserves the route language for dotted 404 paths", async () => {
    const response = await proxy(createProxyRequest("/en/missing.txt", "lang=zh"))

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("x-middleware-request-x-vibeguard-lang")).toBe(
      "en",
    )
    expect(response.headers.get("set-cookie")).toContain("lang=en")
  })
})
