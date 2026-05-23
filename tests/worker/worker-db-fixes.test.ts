import fs from "node:fs"

import { describe, expect, it } from "vitest"

// ---------------------------------------------------------------------------
// Source file paths
// ---------------------------------------------------------------------------
const schemaSource = fs.readFileSync("packages/db/src/schema.ts", "utf8")
const clientSource = fs.readFileSync("packages/db/src/client.ts", "utf8")
const indexSource = fs.readFileSync("apps/worker/src/index.ts", "utf8")
const syncOsvSource = fs.readFileSync("apps/worker/src/sync-osv.ts", "utf8")
const runUtilsSource = fs.readFileSync("apps/worker/src/run-utils.ts", "utf8")

// ===========================================================================
// I01 — UUID v7 optimization comment for high-write tables
// ===========================================================================
describe("I01 — UUID v7 optimization opportunity noted", () => {
  it("schema.ts contains a comment mentioning UUID v7 for high-write tables", () => {
    expect(schemaSource).toMatch(/UUID v7/)
    expect(schemaSource).toMatch(/high-write/)
  })
})

// ===========================================================================
// I02 — feeds_enabled_idx low-selectivity comment
// ===========================================================================
describe("I02 — Boolean index low-selectivity noted", () => {
  it("schema.ts has a comment about the enabled boolean index selectivity", () => {
    expect(schemaSource).toMatch(/feeds_enabled_idx/)
    expect(schemaSource).toMatch(/selectivity/)
  })

  it("mentions partial index as an alternative", () => {
    expect(schemaSource).toMatch(/partial index|WHERE enabled/)
  })
})

// ===========================================================================
// I03 — Singleton pattern documented in client.ts
// ===========================================================================
describe("I03 — Singleton pattern documented", () => {
  it("client.ts has a comment about the singleton pattern and thread safety", () => {
    expect(clientSource).toMatch(/Singleton/)
    expect(clientSource).toMatch(/closeDb/)
    expect(clientSource).toMatch(/re-creation/)
  })
})

// ===========================================================================
// I04 — resolvePollInterval skips redundant String conversion
// ===========================================================================
describe("I04 — resolvePollInterval avoids redundant String conversion", () => {
  it("checks typeof before parseInt", () => {
    expect(indexSource).toMatch(/typeof value === "number"/)
  })

  it("no longer does unconditional String(value) then parseInt", () => {
    // The old pattern was: Number.parseInt(String(value), 10) — unconditional
    // The fix short-circuits when value is already a finite number.
    const resolveFn = indexSource.match(
      /function resolvePollInterval\([\s\S]*?\n\}/,
    )
    expect(resolveFn).not.toBeNull()

    // Should contain a type guard before falling back to parseInt
    expect(resolveFn![0]).toMatch(/typeof value/)
  })
})

// ===========================================================================
// I05 — MAX_BACKOFF_POWER named constant
// ===========================================================================
describe("I05 — Backoff power uses named constant", () => {
  it("index.ts defines MAX_BACKOFF_POWER constant", () => {
    expect(indexSource).toMatch(/const MAX_BACKOFF_POWER = 6/)
  })

  it("computeIdleInterval uses MAX_BACKOFF_POWER instead of magic 6", () => {
    const computeFn = indexSource.match(
      /function computeIdleInterval\([\s\S]*?\n\}/,
    )
    expect(computeFn).not.toBeNull()
    expect(computeFn![0]).toContain("MAX_BACKOFF_POWER")
    // The old magic number 6 should NOT appear directly in the expression
    expect(computeFn![0]).not.toMatch(/Math\.min\([^,]+,\s*6\)/)
  })
})

// ===========================================================================
// I16 — articleEcosystemValues / articleRiskCategoryValues are actually used
// ===========================================================================
describe("I16 — articleEcosystemValues and articleRiskCategoryValues usage", () => {
  it("articleEcosystemValues is used in articleEcosystemEnum pgEnum call", () => {
    // These are NOT unused — they are used in pgEnum() definitions
    expect(schemaSource).toContain("articleEcosystemValues,")
    // Verify it appears inside the pgEnum call for articleEcosystemEnum
    const enumBlock = schemaSource.match(
      /articleEcosystemEnum = pgEnum\([\s\S]*?\);/,
    )
    expect(enumBlock).not.toBeNull()
    expect(enumBlock![0]).toContain("articleEcosystemValues")
  })

  it("articleRiskCategoryValues is used in articleRiskCategoryEnum pgEnum call", () => {
    expect(schemaSource).toContain("articleRiskCategoryValues,")
    const enumBlock = schemaSource.match(
      /articleRiskCategoryEnum = pgEnum\([\s\S]*?\);/,
    )
    expect(enumBlock).not.toBeNull()
    expect(enumBlock![0]).toContain("articleRiskCategoryValues")
  })

  it("both are exported (used by tests and potentially external consumers)", () => {
    expect(schemaSource).toMatch(/export const articleEcosystemValues/)
    expect(schemaSource).toMatch(/export const articleRiskCategoryValues/)
  })
})

// ===========================================================================
// I17 — Module-level mutable global state documented
// ===========================================================================
describe("I17 — Module-level mutable global state noted", () => {
  it("client.ts has a comment about module-level mutable globals", () => {
    expect(clientSource).toMatch(/mutable global/i)
  })

  it("notes the testing difficulty", () => {
    // The comment spans multiple lines, so check for key phrases separately
    expect(clientSource).toContain("hard")
    expect(clientSource).toContain("to test in isolation")
  })
})

// ===========================================================================
// I18 — Duplicated isDirectExecution extracted to shared helper
// ===========================================================================
describe("I18 — Shared isDirectExecution helper", () => {
  it("run-utils.ts exists and exports isDirectExecution", () => {
    expect(runUtilsSource).toMatch(/export function isDirectExecution/)
  })

  it("run-utils.ts uses pathToFileURL for the check", () => {
    expect(runUtilsSource).toMatch(/pathToFileURL/)
    expect(runUtilsSource).toMatch(/moduleUrl/)
  })

  it("index.ts imports isDirectExecution from run-utils", () => {
    expect(indexSource).toMatch(
      /import.*isDirectExecution.*from.*\.\/run-utils/,
    )
  })

  it("sync-osv.ts imports isDirectExecution from run-utils", () => {
    expect(syncOsvSource).toMatch(
      /import.*isDirectExecution.*from.*\.\/run-utils/,
    )
  })

  it("index.ts no longer has inline isDirectExecution definition", () => {
    // Should NOT contain the old pattern of defining isDirectExecution inline
    expect(indexSource).not.toMatch(
      /const isDirectExecution =\s*\n\s*typeof process\.argv/,
    )
  })

  it("sync-osv.ts no longer has inline isDirectExecution definition", () => {
    expect(syncOsvSource).not.toMatch(
      /const isDirectExecution =\s*\n\s*typeof process\.argv/,
    )
  })

  it("both files pass their module URL to isDirectExecution", () => {
    expect(indexSource).toMatch(/isDirectExecution\(import\.meta\.url\)/)
    expect(syncOsvSource).toMatch(/isDirectExecution\(import\.meta\.url\)/)
  })
})
