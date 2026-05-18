import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin shell layout", () => {
  it("shares the widened width and the same light-dark shell language with the public site", () => {
    const shell = fs.readFileSync("apps/web/components/admin/admin-page-shell.tsx", "utf8")
    const layout = fs.readFileSync("apps/web/lib/admin-layout.ts", "utf8")

    expect(layout).toContain("max-w-[1380px]")
    expect(layout).toContain("bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_56%,#eef2f7_100%)]")
    expect(shell).toContain("getAdminBackgroundClassName")
    expect(shell).toContain("getAdminShellClassName")
    expect(shell).toContain("border-b border-slate-200/75 pb-6 dark:border-white/10")
    expect(shell).not.toContain("adminShellLabel")
    expect(shell).not.toContain("内容底座后台")
    expect(shell).not.toContain("VibeGuard Admin")
  })
})
