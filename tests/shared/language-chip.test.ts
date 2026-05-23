import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("language chip usage", () => {
  it("uses one shared language toggle next to the theme switch across public and admin surfaces", () => {
    const home = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8")
    const article = fs.readFileSync("apps/web/app/[lang]/articles/[articleId]/page.tsx", "utf8")
    const adminHeader = fs.readFileSync("apps/web/components/admin/admin-header.tsx", "utf8")
    const publicHeader = fs.readFileSync("apps/web/components/public-header.tsx", "utf8")
    const toggle = fs.readFileSync("apps/web/components/language-toggle.tsx", "utf8")

    expect(toggle).toContain("Languages")
    expect(toggle).toContain("size-8 items-center justify-center")
    expect(toggle).toContain('h-[26px] w-[26px]')
    expect(toggle).toContain('size-[14px]')
    expect(home).toContain("<PublicHeader")
    expect(article).toContain("<PublicHeader")
    expect(publicHeader).toContain("<LanguageToggle")
    expect(adminHeader).toContain("<LanguageToggle")
    expect(publicHeader).toContain('flex items-center justify-end gap-1.5')
    expect(adminHeader).toContain('flex items-center justify-end gap-1.5')
  })
})
