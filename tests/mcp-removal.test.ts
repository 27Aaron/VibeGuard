import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("mcp removal", () => {
  it("removes mcp scripts and machine-query routes from the active project surface", () => {
    const rootPackage = fs.readFileSync("package.json", "utf8")

    expect(rootPackage).not.toContain('"mcp:server"')
    expect(rootPackage).not.toContain('"mcp:config"')
    expect(rootPackage).not.toContain('"demo:query-context"')
    expect(rootPackage).not.toContain('"dev:full"')

    expect(fs.existsSync("packages/mcp-server/package.json")).toBe(false)
    expect(fs.existsSync("scripts/print-mcp-config.mjs")).toBe(false)
    expect(fs.existsSync("scripts/query-context-demo.mjs")).toBe(false)
    expect(fs.existsSync("apps/web/app/api/query/articles/route.ts")).toBe(false)
    expect(fs.existsSync("apps/web/app/api/query/context/route.ts")).toBe(false)
  })
})
