import { describe, expect, it } from "vitest"

import { schema } from "@vibeguard/db"

describe("security intelligence schema", () => {
  it("exposes the compact OSV sync tables without storing raw JSON payloads", () => {
    expect(schema.securitySyncState).toBeDefined()
    expect(schema.securityAdvisories).toBeDefined()
    expect(schema.securityAffectedPackages).toBeDefined()

    expect(schema.securitySourceRecords).toBeUndefined()
    expect("rawJson" in schema.securityAdvisories).toBe(false)
    expect("schemaVersion" in schema.securityAdvisories).toBe(false)
    expect("rawSizeBytes" in schema.securityAdvisories).toBe(false)
    expect("parseStatus" in schema.securityAdvisories).toBe(false)
    expect("parseError" in schema.securityAdvisories).toBe(false)
    expect("sourceEcosystems" in schema.securityAdvisories).toBe(false)
    expect("sourceUrl" in schema.securityAdvisories).toBe(true)
    expect("rawHash" in schema.securityAdvisories).toBe(true)
  })
})
