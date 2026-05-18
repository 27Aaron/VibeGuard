import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public article page width", () => {
  it("matches the widened homepage container and gives long titles more room", () => {
    const page = fs.readFileSync("apps/web/app/articles/[articleId]/page.tsx", "utf8")

    expect(page).toContain("max-w-[1440px]")
    expect(page).toContain("lg:px-8")
    expect(page).toContain("max-w-6xl text-3xl font-semibold")
  })
})
