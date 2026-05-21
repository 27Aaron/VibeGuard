import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("OSV sync command", () => {
  it("exposes a root command for limited local mirror syncs", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.["osv:sync"]).toContain("sync-osv")
    expect(packageJson.scripts?.["osv:sync"]).toContain("--local-defaults")
  })
})
