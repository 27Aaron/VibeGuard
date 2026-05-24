import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("MCP security API tools", () => {
  const clientSource = fs.readFileSync("packages/mcp-server/src/client.ts", "utf8")
  const toolsSource = fs.readFileSync("packages/mcp-server/src/tools.ts", "utf8")
  const skillSource = fs.readFileSync("skill/vibeguard/SKILL.md", "utf8")

  it("client exposes the expanded security REST endpoints", () => {
    expect(clientSource).toContain("async searchAdvisories")
    expect(clientSource).toContain("/api/security/advisories?")
    expect(clientSource).toContain("async getPackageProfile")
    expect(clientSource).toContain("/api/security/packages/${ecosystem}/${encodedName}")
    expect(clientSource).toContain("async getCve")
    expect(clientSource).toContain("/api/security/cves/${cveId.toUpperCase()}")
    expect(clientSource).toContain("async securitySyncStatus")
    expect(clientSource).toContain("/api/security/sync/status")
  })

  it("MCP server registers tools for advisories, packages, CVEs, and sync status", () => {
    expect(toolsSource).toContain('name: "search_advisories"')
    expect(toolsSource).toContain('name: "package_profile"')
    expect(toolsSource).toContain('name: "get_cve"')
    expect(toolsSource).toContain('name: "security_sync_status"')
    expect(toolsSource).toContain("client.searchAdvisories")
    expect(toolsSource).toContain("client.getPackageProfile")
    expect(toolsSource).toContain("client.getCve")
    expect(toolsSource).toContain("client.securitySyncStatus")
  })

  it("VibeGuard skill documents the expanded API surface", () => {
    expect(skillSource).toContain("GET https://vibeguard.ou.al/api/security/advisories")
    expect(skillSource).toContain("GET https://vibeguard.ou.al/api/security/packages/{ecosystem}/{name}")
    expect(skillSource).toContain("GET https://vibeguard.ou.al/api/security/cves/{cveId}")
    expect(skillSource).toContain("GET https://vibeguard.ou.al/api/security/sync/status")
  })
})
