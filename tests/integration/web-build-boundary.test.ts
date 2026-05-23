import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("web build boundaries", () => {
  it("keeps OSV sync out of static web and worker package imports", () => {
    const workerIndex = fs.readFileSync("apps/worker/src/index.ts", "utf8")
    const adminOsvRoute = fs.readFileSync(
      "apps/web/app/api/admin/osv-sync/route.ts",
      "utf8",
    )
    const osvSync = fs.readFileSync("packages/content/src/osv/sync.ts", "utf8")

    expect(workerIndex).not.toContain(
      'from "@vibeguard/content/osv/sync"',
    )
    expect(adminOsvRoute).not.toContain(
      'from "@vibeguard/content/osv/sync"',
    )
    expect(workerIndex).toContain(
      'await import("@vibeguard/content/osv/sync")',
    )
    expect(adminOsvRoute).toContain(
      'await import("@vibeguard/content/osv/sync")',
    )
    expect(osvSync).not.toContain('import("yauzl-promise")')
    expect(osvSync).toContain("loadYauzlPromise")
  })
})
