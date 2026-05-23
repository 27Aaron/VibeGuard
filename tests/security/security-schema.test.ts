import { describe, expect, it } from "vitest"

import { schema } from "@vibeguard/db"

describe("security intelligence schema", () => {
  it("exposes the compact four-table security intelligence schema", () => {
    expect(schema.securitySyncState).toBeDefined()
    expect(schema.securityAdvisories).toBeDefined()
    expect(schema.securityAffectedPackages).toBeDefined()
    expect(schema.securityCveEnrichments).toBeDefined()

    expect(schema.securitySourceRecords).toBeUndefined()
    expect("rawJson" in schema.securityAdvisories).toBe(false)
    expect("schemaVersion" in schema.securityAdvisories).toBe(false)
    expect("rawSizeBytes" in schema.securityAdvisories).toBe(false)
    expect("parseStatus" in schema.securityAdvisories).toBe(false)
    expect("parseError" in schema.securityAdvisories).toBe(false)
    expect("sourceEcosystems" in schema.securityAdvisories).toBe(false)
    expect("sourceUrl" in schema.securityAdvisories).toBe(true)
    expect("rawHash" in schema.securityAdvisories).toBe(true)
    expect("aliases" in schema.securityAdvisories).toBe(true)
    expect("scope" in schema.securitySyncState).toBe(true)
    expect("cursorJson" in schema.securitySyncState).toBe(true)
    expect("ecosystem" in schema.securitySyncState).toBe(false)
    expect("bestCvssScore" in schema.securityCveEnrichments).toBe(true)
    expect("epss" in schema.securityCveEnrichments).toBe(true)
    expect("kevListed" in schema.securityCveEnrichments).toBe(true)
  })
})
