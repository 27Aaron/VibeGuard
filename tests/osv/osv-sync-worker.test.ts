import { describe, expect, it, vi } from "vitest"

import { hasSuccessfulSyncMarker } from "../../apps/worker/src/index"
import {
  formatEnrichmentSyncSummaryLine,
  formatSyncSummaryLine,
  getEnrichmentSyncMode,
} from "../../apps/worker/src/sync-osv"

describe("formatSyncSummaryLine", () => {
  it("prints new changed and skipped counts for bootstrap output", () => {
    expect(
      formatSyncSummaryLine("bootstrap", {
        ecosystem: "npm",
        recordsSeen: 20,
        recordsImported: 3,
        recordsNew: 1,
        recordsChanged: 2,
        recordsSkipped: 17,
        recordsFailed: 0,
        lastProcessedModifiedAt: new Date("2026-05-21T23:01:37.118Z"),
      }),
    ).toBe(
      "osv bootstrap npm seen=20 imported=3 new=1 changed=2 skipped=17 failed=0",
    )
  })
})

describe("formatEnrichmentSyncSummaryLine", () => {
  it("prints the enrichment source and compact import counts", () => {
    expect(
      formatEnrichmentSyncSummaryLine({
        source: "nvd",
        scope: "modified",
        recordsSeen: 10,
        recordsImported: 9,
        recordsFailed: 0,
      }),
    ).toBe(
      "security enrichment nvd/modified seen=10 imported=9 failed=0",
    )
  })
})

describe("getEnrichmentSyncMode", () => {
  it("keeps manual OSV bootstrap and enrichment bootstrap aligned", () => {
    expect(getEnrichmentSyncMode("bootstrap")).toBe("bootstrap")
    expect(getEnrichmentSyncMode("incremental")).toBe("incremental")
  })
})

describe("hasSuccessfulSyncMarker", () => {
  it("only treats a successful source/full marker as bootstrap complete", async () => {
    const findFirst = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: "failed" })
      .mockResolvedValueOnce({ status: "success" })
    const db = {
      query: {
        securitySyncState: { findFirst },
      },
    } as never

    await expect(hasSuccessfulSyncMarker(db, "osv", "full")).resolves.toBe(false)
    await expect(hasSuccessfulSyncMarker(db, "osv", "full")).resolves.toBe(false)
    await expect(hasSuccessfulSyncMarker(db, "osv", "full")).resolves.toBe(true)
    expect(findFirst).toHaveBeenCalledTimes(3)
  })
})
