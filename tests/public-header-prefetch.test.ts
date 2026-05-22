import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public header API link prefetch", () => {
  it("disables API link prefetch so homepage startup does not eagerly warm the API docs page", () => {
    const publicHeader = fs.readFileSync("apps/web/components/public-header.tsx", "utf8")

    expect(publicHeader).toContain('prefetch={item.label === "API" || item.label === "MCP" ? false : undefined}')
  })
})
