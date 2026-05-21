import { describe, expect, it } from "vitest"

import { schema } from "@vibeguard/db"

describe("security intelligence schema", () => {
  it("exposes the OSV sync tables without storing raw JSON payloads", () => {
    expect(schema.securitySyncState).toBeDefined()
    expect(schema.securitySourceRecords).toBeDefined()
    expect(schema.securityAdvisories).toBeDefined()
    expect(schema.securityAffectedPackages).toBeDefined()

    expect("rawJson" in schema.securitySourceRecords).toBe(false)
  })
})
