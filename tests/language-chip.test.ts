import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("language chip usage", () => {
  it("uses one shared language toggle next to the theme switch across public and admin surfaces", () => {
    const home = fs.readFileSync("apps/web/app/page.tsx", "utf8")
    const article = fs.readFileSync("apps/web/app/articles/[articleId]/page.tsx", "utf8")
    const adminShell = fs.readFileSync("apps/web/components/admin/admin-page-shell.tsx", "utf8")
    const toggle = fs.readFileSync("apps/web/components/language-toggle.tsx", "utf8")

    expect(toggle).toContain("Languages")
    expect(toggle).toContain("size-8 items-center justify-center")
    expect(toggle).toContain('h-[26px] w-[26px]')
    expect(toggle).toContain('size-[14px]')
    expect(home).toContain("<LanguageToggle")
    expect(article).toContain("<LanguageToggle")
    expect(adminShell).toContain("<LanguageToggle")
    expect(home).toContain('flex items-center justify-end gap-1.5')
    expect(article).toContain('flex items-center gap-1.5')
    expect(adminShell).toContain('flex items-center gap-1.5')
  })
})
