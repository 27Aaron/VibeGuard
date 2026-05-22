import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("theme toggle", () => {
  it("boots theme from system preference and local storage before hydration", () => {
    const layout = fs.readFileSync("apps/web/app/layout.tsx", "utf8")
    const theme = fs.readFileSync("apps/web/lib/theme.ts", "utf8")
    const themeInit = fs.readFileSync("apps/web/public/theme-init.js", "utf8")

    expect(layout).toContain('id="theme-bootstrap"')
    expect(layout).toContain('from "next/script"')
    expect(layout).toContain('strategy="beforeInteractive"')
    expect(layout).toContain('src="/theme-init.js"')
    expect(layout).toContain("<body")
    expect(layout).toContain("<Script")
    expect(layout).not.toContain("<script")
    expect(layout).not.toContain("dangerouslySetInnerHTML")
    expect(layout).not.toContain("THEME_BOOTSTRAP_SCRIPT")
    expect(theme).toContain('export const THEME_STORAGE_KEY = "vibeguard-theme"')
    expect(themeInit).toContain('window.matchMedia("(prefers-color-scheme: dark)")')
    expect(themeInit).toContain('const stored = localStorage.getItem(storageKey);')
    expect(themeInit).toContain('root.classList.toggle("dark", resolved === "dark")')
  })

  it("uses the lucide-style pill toggle across public and admin surfaces", () => {
    const toggle = fs.readFileSync("apps/web/components/theme-toggle.tsx", "utf8")
    const home = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8")
    const article = fs.readFileSync("apps/web/app/[lang]/articles/[articleId]/page.tsx", "utf8")
    const publicHeader = fs.readFileSync("apps/web/components/public-header.tsx", "utf8")
    const adminHeader = fs.readFileSync("apps/web/components/admin/admin-header.tsx", "utf8")

    expect(toggle).toContain("MoonStar")
    expect(toggle).toContain("SunMedium")
    expect(toggle).toContain("h-8 w-14")
    expect(toggle).toContain('dark:translate-x-[24px]')
    expect(toggle).toContain('h-[26px] w-[26px]')
    expect(toggle).toContain("createThemeTransition")
    expect(toggle).toContain("activeTransitionRef")
    expect(toggle).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")')
    expect(toggle).toContain("readResolvedThemeFromDom")
    expect(home).toContain("<PublicHeader")
    expect(article).toContain("<PublicHeader")
    expect(publicHeader).toContain("<ThemeToggle />")
    expect(adminHeader).toContain("<ThemeToggle />")
  })

  it("animates the shell, thumb, and icons with a smoother micro-interaction", () => {
    const toggle = fs.readFileSync("apps/web/components/theme-toggle.tsx", "utf8")

    expect(toggle).toContain("duration-300 ease-out")
    expect(toggle).toContain("dark:opacity-0 dark:scale-[0.68]")
    expect(toggle).toContain("dark:rotate-[-24deg]")
    expect(toggle).toContain("rotate-[24deg] dark:opacity-100")
  })
})
