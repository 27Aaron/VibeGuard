import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("security API documentation", () => {
  const openapi = fs.readFileSync("apps/web/public/openapi.yaml", "utf8")
  const apiPage = fs.readFileSync("apps/web/app/[lang]/api/page.tsx", "utf8")

  it("documents the expanded security API routes in OpenAPI", () => {
    expect(openapi).toContain("/api/security/advisories:")
    expect(openapi).toContain("/api/security/advisories/{advisoryId}:")
    expect(openapi).toContain("/api/security/packages/{ecosystem}/{packageName}:")
    expect(openapi).toContain("/api/security/cves/{cveId}:")
    expect(openapi).toContain("/api/security/sync/status:")
  })

  it("documents package-check enrichment fields in OpenAPI", () => {
    expect(openapi).toContain("confidence:")
    expect(openapi).toContain("matchReason:")
    expect(openapi).toContain("withdrawnAt:")
    expect(openapi).toContain("related:")
    expect(openapi).toContain("upstream:")
    expect(openapi).toContain("maliciousOrigins:")
    expect(openapi).toContain("cvssMetrics:")
    expect(openapi).toContain("epssScoreDate:")
    expect(openapi).toContain("kevDateAdded:")
    expect(openapi).toContain("nvdModifiedAt:")
  })

  it("shows the new API routes on the public API page", () => {
    expect(apiPage).toContain('path="/api/security/advisories"')
    expect(apiPage).toContain('path="/api/security/advisories/{id}"')
    expect(apiPage).toContain('path="/api/security/packages/{ecosystem}/{name}"')
    expect(apiPage).toContain('path="/api/security/cves/{id}"')
    expect(apiPage).toContain('path="/api/security/sync/status"')
  })
})
