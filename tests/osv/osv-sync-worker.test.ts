import { describe, expect, it } from "vitest"

import { formatSyncSummaryLine } from "../../apps/worker/src/sync-osv"

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
