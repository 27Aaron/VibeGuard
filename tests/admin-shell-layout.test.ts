import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin shell layout", () => {
  it("shares the widened width and the same light-dark shell language with the public site", () => {
    const shell = fs.readFileSync("apps/web/components/admin/admin-page-shell.tsx", "utf8")
    const layout = fs.readFileSync("apps/web/lib/admin-layout.ts", "utf8")

    expect(layout).toContain("max-w-[1440px]")
    expect(layout).toContain("bg-[#f2f2f0]")
    expect(layout).toContain("dark:bg-[#070b0f]")
    expect(layout).toContain("getAdminBackdropClassName")
    expect(layout).toContain("getAdminTableSurfaceClassName")
    expect(shell).toContain("getAdminBackgroundClassName")
    expect(shell).toContain("getAdminShellClassName")
    expect(shell).toContain("getAdminBackdropClassName")
    expect(shell).toContain("backdrop-blur-2xl")
    expect(shell).toContain("Admin console")
    expect(shell).toContain("后台工作台")
    expect(shell).not.toContain("adminShellLabel")
    expect(shell).not.toContain("内容底座后台")
    expect(shell).not.toContain("VibeGuard Admin")
  })
})
