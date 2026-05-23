import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

// ---------------------------------------------------------------------------
// Shared package exports
// ---------------------------------------------------------------------------
import {
  ARTICLE_STATUS_VALUES,
  MCP_CHECK_ECOSYSTEMS,
  MCP_ECOSYSTEMS,
  MCP_RISK_CATEGORIES,
  normalizeInt,
  SecurityPackageMatchConfidence,
  SECURITY_PACKAGE_MATCH_CONFIDENCE_VALUES,
} from "@vibeguard/shared"

// ---------------------------------------------------------------------------
// MCP server client types (I36 — must be exported)
// ---------------------------------------------------------------------------
import type {
  ArticleDetail,
  ArticleListItem,
  ArticleListMeta,
  PackageFinding,
  SecurityOverviewTotals,
} from "@vibeguard/mcp-server/client"

// ===========================================================================
// I12 — readPackageVersion uses async fs.promises.readFile
// ===========================================================================
describe("I12: readPackageVersion is async", () => {
  const serverPath = path.resolve("packages/mcp-server/src/server.ts")
  const source = fs.readFileSync(serverPath, "utf8")

  it("imports from node:fs/promises (not node:fs)", () => {
    expect(source).toMatch(/from\s+["']node:fs\/promises["']/)
    expect(source).not.toContain('from "node:fs"')
    expect(source).not.toContain("readFileSync")
  })

  it("readPackageVersion is an async function", () => {
    expect(source).toMatch(/async\s+function\s+readPackageVersion/)
  })

  it("uses await fs.readFile (not sync)", () => {
    expect(source).toMatch(/await\s+fs\.readFile/)
    expect(source).not.toContain("fs.readFileSync")
  })

  it("version is assigned with await", () => {
    expect(source).toMatch(/const\s+version\s*=\s*await\s+readPackageVersion/)
  })
})

// ===========================================================================
// I33 — ToolDefinition uses generics for inputSchema type info
// ===========================================================================
describe("I33: ToolDefinition has type parameter for inputSchema", () => {
  const toolsPath = path.resolve("packages/mcp-server/src/tools.ts")
  const source = fs.readFileSync(toolsPath, "utf8")

  it("ToolDefinition interface has a generic type parameter", () => {
    expect(source).toMatch(/interface\s+ToolDefinition\s*<\s*T\s+extends\s+Record<string,\s*z\.ZodTypeAny/)
  })

  it("ToolHandler type has a matching generic parameter", () => {
    expect(source).toMatch(/type\s+ToolHandler\s*<\s*T\s+extends\s+Record<string,\s*z\.ZodTypeAny/)
  })
})

// ===========================================================================
// I34 — ecosystems/riskCategories extracted to shared constants
// ===========================================================================
describe("I34: ecosystems/riskCategories come from shared package", () => {
  const toolsPath = path.resolve("packages/mcp-server/src/tools.ts")
  const source = fs.readFileSync(toolsPath, "utf8")

  it("tools.ts imports MCP_ECOSYSTEMS, MCP_RISK_CATEGORIES from @vibeguard/shared", () => {
    expect(source).toMatch(/import\s*\{[^}]*MCP_ECOSYSTEMS[^}]*\}\s*from\s*["']@vibeguard\/shared["']/)
    expect(source).toMatch(/import\s*\{[^}]*MCP_RISK_CATEGORIES[^}]*\}\s*from\s*["']@vibeguard\/shared["']/)
  })

  it("tools.ts does NOT define local ecosystems or riskCategories arrays", () => {
    // The local arrays should be gone — only the imported names remain
    expect(source).not.toMatch(/const\s+ecosystems\s*=/)
    expect(source).not.toMatch(/const\s+riskCategories\s*=/)
  })

  it("shared mcp-constants file exists and exports the constants", () => {
    const constPath = path.resolve("packages/shared/src/mcp-constants.ts")
    expect(fs.existsSync(constPath)).toBe(true)
    const constSource = fs.readFileSync(constPath, "utf8")
    expect(constSource).toContain("export const MCP_ECOSYSTEMS")
    expect(constSource).toContain("export const MCP_RISK_CATEGORIES")
    expect(constSource).toContain("export const MCP_CHECK_ECOSYSTEMS")
  })

  it("MCP_ECOSYSTEMS has the expected values", () => {
    expect([...MCP_ECOSYSTEMS]).toEqual([
      "npm", "pypi", "maven", "go", "crates-io", "github-actions", "docker", "multi",
    ])
  })

  it("MCP_RISK_CATEGORIES has the expected values", () => {
    expect([...MCP_RISK_CATEGORIES]).toEqual([
      "vulnerability", "exploit-activity", "malicious-package", "supply-chain-attack", "dependency-risk",
    ])
  })

  it("MCP_CHECK_ECOSYSTEMS has the expected values", () => {
    expect([...MCP_CHECK_ECOSYSTEMS]).toEqual(["npm", "pypi", "go", "crates-io"])
  })
})

// ===========================================================================
// I35 — redundant "as const" removed from server.ts
// ===========================================================================
describe("I35: redundant as const removed from server.ts", () => {
  const serverPath = path.resolve("packages/mcp-server/src/server.ts")
  const source = fs.readFileSync(serverPath, "utf8")

  it('has no "as const" on type: "text" literals', () => {
    expect(source).not.toMatch(/type:\s*"text"\s+as\s+const/)
  })

  it('still has type: "text" (without as const)', () => {
    expect(source).toMatch(/type:\s*"text"/)
  })
})

// ===========================================================================
// I36 — key types exported from client.ts
// ===========================================================================
describe("I36: client.ts exports key types", () => {
  const clientPath = path.resolve("packages/mcp-server/src/client.ts")
  const source = fs.readFileSync(clientPath, "utf8")

  const expectedTypes = [
    "ArticleListItem",
    "ArticleListMeta",
    "ArticleDetail",
    "PackageFinding",
    "SecurityOverviewTotals",
  ]

  for (const typeName of expectedTypes) {
    it(`${typeName} is exported`, () => {
      expect(source).toMatch(new RegExp(`export\\s+type\\s+${typeName}\\s*=`))
    })
  }
})

// ===========================================================================
// I13 — defineStatuses callers no longer need `as const`
// ===========================================================================
describe("I13: defineStatuses callers use const type parameter, no `as const` needed", () => {
  const typesPath = path.resolve("packages/shared/src/types.ts")
  const source = fs.readFileSync(typesPath, "utf8")

  it("defineStatuses has const type parameter", () => {
    expect(source).toMatch(/function\s+defineStatuses\s*<\s*const\s+TValues/)
  })

  it("no call site passes `as const` to defineStatuses", () => {
    // After the function uses `<const>`, callers should not need `as const`
    expect(source).not.toMatch(/defineStatuses\([\s\S]*as\s+const\s*\]/)
  })

  it("ARTICLE_STATUS_VALUES still produces the correct literal type", () => {
    // Verify the type inference works — values should be a readonly tuple
    expect(ARTICLE_STATUS_VALUES).toContain("pending")
    expect(ARTICLE_STATUS_VALUES).toContain("ready")
    const first: (typeof ARTICLE_STATUS_VALUES)[number] = "processing"
    expect(first).toBe("processing")
  })
})

// ===========================================================================
// I14 — clarifying comment on ArticleStatus dual name pattern
// ===========================================================================
describe("I14: ArticleStatus naming pattern is documented", () => {
  const typesPath = path.resolve("packages/shared/src/types.ts")
  const source = fs.readFileSync(typesPath, "utf8")

  it("has a comment explaining the dual const/type pattern", () => {
    // Should mention that ArticleStatus is both a const value and a type
    expect(source).toMatch(/Note.*ArticleStatus.*both.*const.*type|both.*type.*const/si)
  })
})

// ===========================================================================
// I15 — SecurityPackageMatchConfidence "none" semantics documented
// ===========================================================================
describe("I15: SecurityPackageMatchConfidence 'none' semantics documented", () => {
  const typesPath = path.resolve("packages/shared/src/types.ts")
  const source = fs.readFileSync(typesPath, "utf8")

  it("has JSDoc explaining 'none' means no match found (not explicitly safe)", () => {
    // The JSDoc should clarify that "none" = no match found
    expect(source).toMatch(/"none".*no match was found/i)
    // And should clarify it does NOT mean safe
    expect(source).toMatch(/does\s*not.*mean.*safe|not.*explicitly\s+safe|not.*explicitly\s+unaffected/i)
  })

  it("confidence values are correct", () => {
    expect([...SECURITY_PACKAGE_MATCH_CONFIDENCE_VALUES]).toEqual(["high", "medium", "low", "none"])
  })

  it("SecurityPackageMatchConfidence runtime map works", () => {
    expect(SecurityPackageMatchConfidence.NONE).toBe("none")
    expect(SecurityPackageMatchConfidence.HIGH).toBe("high")
  })
})

// ===========================================================================
// I37 — normalizeInt early returns for empty/falsy values
// ===========================================================================
describe("I37: normalizeInt handles empty input with early return", () => {
  const normalizePath = path.resolve("packages/shared/src/normalize.ts")
  const source = fs.readFileSync(normalizePath, "utf8")

  it("has an early return for falsy values before parseInt", () => {
    expect(source).toMatch(/if\s*\(!value\)\s*\{[^}]*return\s+safeFallback/s)
  })

  // Runtime tests
  it("returns fallback for undefined input", () => {
    expect(normalizeInt(undefined, 5)).toBe(5)
  })

  it("returns fallback for empty string input", () => {
    expect(normalizeInt("", 10)).toBe(10)
  })

  it("returns fallback for whitespace-only input (still falsy after trim check)", () => {
    // "  " is truthy but parseInt("  ") returns NaN → safeFallback
    expect(normalizeInt("  ", 7)).toBe(7)
  })

  it("still parses valid numbers correctly", () => {
    expect(normalizeInt("42", 5)).toBe(42)
    expect(normalizeInt("1", 5)).toBe(1)
  })

  it("respects minimum and maximum bounds", () => {
    expect(normalizeInt("0", 5, 1)).toBe(5)
    expect(normalizeInt("999", 5, 1, 100)).toBe(5)
  })

  it("clamps fallback into valid range", () => {
    expect(normalizeInt(undefined, -5, 1)).toBe(1)
    expect(normalizeInt(undefined, 999, 1, 10)).toBe(10)
  })
})
