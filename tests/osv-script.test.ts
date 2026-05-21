import fs from "node:fs"

import { describe, expect, it } from "vitest"

import { parseArgs } from "../apps/worker/src/sync-osv"

describe("OSV sync command", () => {
  it("exposes a root command for limited local mirror syncs", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.["osv:sync"]).toContain("sync-osv")
    expect(packageJson.scripts?.["osv:sync"]).toContain("--local-defaults")
  })

  it("defaults to incremental sync mode and allows bootstrap mode overrides", () => {
    expect(parseArgs([])).toEqual({
      mode: "incremental",
      limit: 20,
      concurrency: 2,
    })
    expect(
      parseArgs(["--mode=bootstrap", "--concurrency=3", "--limit=50"]),
    ).toEqual({
      mode: "bootstrap",
      limit: 50,
      concurrency: 3,
    })
    expect(parseArgs(["--mode=bootstrap"])).toEqual({
      mode: "bootstrap",
      limit: undefined,
      concurrency: 2,
    })
  })
})
