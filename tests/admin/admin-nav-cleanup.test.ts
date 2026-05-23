import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin navigation cleanup", () => {
  it("removes the leftover MVP badge from the admin navigation shell", () => {
    const nav = fs.readFileSync("apps/web/components/admin/admin-nav.tsx", "utf8")
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8")

    expect(nav).not.toContain("adminNavBadge")
    expect(nav).not.toContain("<Badge")
    expect(copy).not.toContain("adminNavBadge")
  })
})
