import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("theme toggle", () => {
  it("boots theme from system preference and local storage before hydration", () => {
    const layout = fs.readFileSync("apps/web/app/layout.tsx", "utf8")
    const theme = fs.readFileSync("apps/web/lib/theme.ts", "utf8")

    expect(layout).toContain('id="theme-bootstrap"')
    expect(layout).toContain("<head>")
    expect(layout).toContain("<script")
    expect(theme).toContain('window.matchMedia("(prefers-color-scheme: dark)")')
    expect(theme).toContain('const stored = localStorage.getItem(storageKey);')
    expect(theme).toContain('root.classList.toggle("dark", resolved === "dark")')
  })

  it("uses the lucide-style pill toggle across public and admin surfaces", () => {
    const toggle = fs.readFileSync("apps/web/components/theme-toggle.tsx", "utf8")
    const home = fs.readFileSync("apps/web/app/page.tsx", "utf8")
    const article = fs.readFileSync("apps/web/app/articles/[articleId]/page.tsx", "utf8")
    const adminShell = fs.readFileSync("apps/web/components/admin/admin-page-shell.tsx", "utf8")

    expect(toggle).toContain("MoonStar")
    expect(toggle).toContain("SunMedium")
    expect(toggle).toContain("h-8 w-14")
    expect(toggle).toContain('dark:translate-x-[24px]')
    expect(toggle).toContain('h-[26px] w-[26px]')
    expect(toggle).toContain("createThemeTransition")
    expect(toggle).toContain("buttonRef")
    expect(toggle).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")')
    expect(toggle).toContain("readResolvedThemeFromDom")
    expect(home).toContain("<ThemeToggle />")
    expect(article).toContain("<ThemeToggle />")
    expect(adminShell).toContain("<ThemeToggle />")
  })

  it("animates the shell, thumb, and icons with a smoother micro-interaction", () => {
    const toggle = fs.readFileSync("apps/web/components/theme-toggle.tsx", "utf8")

    expect(toggle).toContain("duration-[980ms]")
    expect(toggle).toContain("cubic-bezier(0.08,0.82,0.17,1)")
    expect(toggle).toContain("dark:opacity-0 dark:scale-[0.68]")
    expect(toggle).toContain("dark:rotate-[-24deg]")
    expect(toggle).toContain("rotate-[24deg] dark:opacity-100")
  })
})
