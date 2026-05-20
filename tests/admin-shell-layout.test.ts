import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin shell layout", () => {
  it("shares the widened width and the same light-dark shell language with the public site", () => {
    const shell = fs.readFileSync("apps/web/components/admin/admin-page-shell.tsx", "utf8")
    const adminLayout = fs.readFileSync("apps/web/app/[lang]/admin/layout.tsx", "utf8")
    const adminHeader = fs.readFileSync("apps/web/components/admin/admin-header.tsx", "utf8")
    const layout = fs.readFileSync("apps/web/lib/admin-layout.ts", "utf8")
    const layoutTokens = fs.readFileSync("apps/web/lib/layout-tokens.ts", "utf8")

    expect(layoutTokens).toContain("max-w-[1440px]")
    expect(layoutTokens).toContain("bg-[#f2f2f0]")
    expect(layoutTokens).toContain("dark:bg-[#070b0f]")
    expect(layout).toContain("getAdminBackdropClassName")
    expect(layout).toContain("getAdminTableSurfaceClassName")
    expect(adminLayout).toContain("getAdminBackgroundClassName")
    expect(adminLayout).toContain("getAdminShellClassName")
    expect(adminLayout).toContain("getAdminBackdropClassName")
    expect(adminLayout).toContain("<AdminHeader")
    expect(adminHeader).toContain("backdrop-blur-2xl")
    expect(adminHeader).toContain("Console")
    expect(shell).toContain("后台工作台")
    expect(shell).not.toContain("adminShellLabel")
    expect(shell).not.toContain("内容底座后台")
    expect(shell).not.toContain("VibeGuard Admin")
  })
})
