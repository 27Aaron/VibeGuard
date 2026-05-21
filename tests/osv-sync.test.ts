import fs from "node:fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  buildModifiedIdCsvUrl,
  parseModifiedIdCsv,
  syncAllOsvEcosystems,
  syncOsvEcosystem,
} from "../packages/content/src/osv/sync"

describe("parseModifiedIdCsv", () => {
  it("parses newest OSV modified rows and skips invalid lines", () => {
    expect(
      parseModifiedIdCsv(
        [
          "2026-05-21T23:01:37.118219322Z,MAL-2026-4230",
          "bad-line",
          "2026-05-21T22:45:09.675686188Z,GHSA-j3vx-cx2r-pvg8",
        ].join("\n"),
      ),
    ).toEqual([
      {
        modifiedAt: new Date("2026-05-21T23:01:37.118Z"),
        externalId: "MAL-2026-4230",
      },
      {
        modifiedAt: new Date("2026-05-21T22:45:09.675Z"),
        externalId: "GHSA-j3vx-cx2r-pvg8",
      },
    ])
  })
})

describe("OSV sync urls", () => {
  it("builds modified_id.csv URLs for each ecosystem", () => {
    expect(buildModifiedIdCsvUrl("npm")).toBe(
      "https://storage.googleapis.com/osv-vulnerabilities/npm/modified_id.csv",
    )
  })
})

describe("syncOsvEcosystem", () => {
  it("downloads a limited set, stores normalized records, deletes cached JSON, and updates sync state", async () => {
    const repoRoot = fs.mkdtempSync(path.join("/tmp", "vibeguard-osv-sync-"))
    const upsertNormalizedOsvRecord = vi.fn().mockResolvedValue({
      sourceRecordId: "source-1",
      advisoryId: "advisory-1",
      affectedPackageCount: 1,
    })
    const upsertSecuritySyncState = vi.fn().mockResolvedValue(undefined)

    const summary = await syncOsvEcosystem({
      db: {} as never,
      ecosystem: "npm",
      repoRoot,
      limit: 1,
      now: () => new Date("2026-05-22T08:00:00Z"),
      fetchText: async (url) => {
        if (url.endsWith("modified_id.csv")) {
          return "2026-05-21T23:01:37.118219322Z,MAL-2026-4230\n"
        }

        return JSON.stringify({
          schema_version: "1.7.5",
          id: "MAL-2026-4230",
          published: "2026-05-21T21:15:38Z",
          modified: "2026-05-21T23:01:37.118219322Z",
          summary: "Malicious code in cryptoco-auth (npm)",
          affected: [
            {
              package: {
                name: "cryptoco-auth",
                ecosystem: "npm",
                purl: "pkg:npm/cryptoco-auth",
              },
              versions: ["1.0.0"],
            },
          ],
        })
      },
      upsertNormalizedOsvRecord,
      upsertSecuritySyncState,
    })

    expect(summary).toEqual({
      ecosystem: "npm",
      recordsSeen: 1,
      recordsImported: 1,
      recordsFailed: 0,
      lastProcessedModifiedAt: new Date("2026-05-21T23:01:37.118Z"),
    })
    expect(upsertNormalizedOsvRecord).toHaveBeenCalledTimes(1)
    expect(upsertSecuritySyncState).toHaveBeenLastCalledWith(
      {} as never,
      "npm",
      expect.objectContaining({
        status: "success",
        recordsSeen: 1,
        recordsImported: 1,
        recordsFailed: 0,
      }),
    )
    expect(
      fs.existsSync(
        path.join(repoRoot, "data", "osv-cache", "npm", "MAL-2026-4230.json"),
      ),
    ).toBe(false)
  })
})

describe("syncAllOsvEcosystems", () => {
  it("syncs the four MVP ecosystems with the same limit", async () => {
    const syncOne = vi.fn().mockImplementation(({ ecosystem }) =>
      Promise.resolve({
        ecosystem,
        recordsSeen: 1,
        recordsImported: 1,
        recordsFailed: 0,
        lastProcessedModifiedAt: new Date("2026-05-21T23:01:37.118Z"),
      }),
    )

    const results = await syncAllOsvEcosystems({
      db: {} as never,
      limit: 2,
      syncOne,
    })

    expect(results.map((result) => result.ecosystem)).toEqual([
      "npm",
      "PyPI",
      "Go",
      "crates.io",
    ])
    expect(syncOne).toHaveBeenCalledTimes(4)
    expect(syncOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ ecosystem: "npm", limit: 2 }),
    )
  })
})
