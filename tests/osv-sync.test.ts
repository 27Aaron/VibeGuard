import fs from "node:fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  bootstrapAllOsvEcosystems,
  bootstrapOsvEcosystem,
  buildBootstrapArchiveEntriesListCommand,
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

  it("builds the unzip command used to list bootstrap archive entries", () => {
    expect(buildBootstrapArchiveEntriesListCommand("/tmp/npm/all.zip")).toEqual([
      "unzip",
      "-Z1",
      "/tmp/npm/all.zip",
    ])
  })
})

describe("syncOsvEcosystem", () => {
  it("downloads a limited set, stores normalized records, deletes cached JSON, and updates sync state", async () => {
    const repoRoot = fs.mkdtempSync(path.join("/tmp", "vibeguard-osv-sync-"))
    const upsertNormalizedOsvRecord = vi.fn().mockResolvedValue({
      advisoryId: "advisory-1",
      affectedPackageCount: 1,
      skipped: false,
      writeKind: "new",
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
      recordsNew: 1,
      recordsChanged: 0,
      recordsSkipped: 0,
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

describe("bootstrapOsvEcosystem", () => {
  it("imports every JSON entry from an official per-ecosystem all.zip archive and deletes the cached zip", async () => {
    const repoRoot = fs.mkdtempSync(path.join("/tmp", "vibeguard-osv-bootstrap-"))
    const upsertNormalizedOsvRecord = vi.fn().mockResolvedValue({
      advisoryId: "advisory-1",
      affectedPackageCount: 1,
      skipped: false,
    })
    const upsertSecuritySyncState = vi.fn().mockResolvedValue(undefined)
    const deleteCachedFile = vi.fn().mockResolvedValue(undefined)
    const downloadArchive = vi.fn().mockResolvedValue(
      path.join(repoRoot, "data", "osv-bootstrap", "npm", "all.zip"),
    )

    const summary = await bootstrapOsvEcosystem({
      db: {} as never,
      ecosystem: "npm",
      repoRoot,
      now: () => new Date("2026-05-22T08:00:00Z"),
      downloadArchiveToCache: downloadArchive,
      iterateArchiveEntries: async function* () {
        yield {
          entryName: "MAL-2026-4230.json",
          readText: async () =>
            JSON.stringify({
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
                  versions: ["1.0.6"],
                },
              ],
            }),
        }
        yield {
          entryName: "README.txt",
          readText: async () => "ignored",
        }
      },
      deleteCachedFile,
      upsertNormalizedOsvRecord,
      upsertSecuritySyncState,
    })

    expect(summary).toEqual({
      ecosystem: "npm",
      recordsSeen: 1,
      recordsImported: 1,
      recordsNew: 0,
      recordsChanged: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      lastProcessedModifiedAt: new Date("2026-05-21T23:01:37.118Z"),
    })
    expect(downloadArchive).toHaveBeenCalledTimes(1)
    expect(upsertNormalizedOsvRecord).toHaveBeenCalledTimes(1)
    expect(deleteCachedFile).toHaveBeenCalledWith(
      path.join(repoRoot, "data", "osv-bootstrap", "npm", "all.zip"),
    )
    expect(deleteCachedFile).toHaveBeenCalledTimes(1)
  })

  it("does not count hash-skipped advisories as imported", async () => {
    const repoRoot = fs.mkdtempSync(path.join("/tmp", "vibeguard-osv-bootstrap-"))
    const upsertNormalizedOsvRecord = vi.fn().mockResolvedValue({
      advisoryId: "advisory-1",
      affectedPackageCount: 1,
      skipped: true,
    })

    const summary = await bootstrapOsvEcosystem({
      db: {} as never,
      ecosystem: "npm",
      repoRoot,
      now: () => new Date("2026-05-22T08:00:00Z"),
      downloadArchiveToCache: vi.fn().mockResolvedValue(
        path.join(repoRoot, "data", "osv-bootstrap", "npm", "all.zip"),
      ),
      iterateArchiveEntries: async function* () {
        yield {
          entryName: "MAL-2026-4230.json",
          readText: async () =>
            JSON.stringify({
              schema_version: "1.7.5",
              id: "MAL-2026-4230",
              published: "2026-05-21T21:15:38Z",
              modified: "2026-05-21T23:01:37.118219322Z",
              summary: "Malicious code in cryptoco-auth (npm)",
              affected: [],
            }),
        }
      },
      deleteCachedFile: vi.fn().mockResolvedValue(undefined),
      upsertNormalizedOsvRecord,
      upsertSecuritySyncState: vi.fn().mockResolvedValue(undefined),
    })

    expect(summary.recordsSeen).toBe(1)
    expect(summary.recordsImported).toBe(0)
    expect(summary.recordsFailed).toBe(0)
  })

  it("flushes bootstrap entries in batches before writing to the database", async () => {
    const repoRoot = fs.mkdtempSync(path.join("/tmp", "vibeguard-osv-bootstrap-"))
    const upsertNormalizedOsvRecordsBatch = vi
      .fn()
      .mockResolvedValueOnce({
        importedCount: 2,
        newCount: 1,
        changedCount: 1,
        skippedCount: 0,
        results: [],
      })
      .mockResolvedValueOnce({
        importedCount: 1,
        newCount: 0,
        changedCount: 1,
        skippedCount: 0,
        results: [],
      })

    const summary = await bootstrapOsvEcosystem({
      db: {} as never,
      ecosystem: "npm",
      repoRoot,
      batchSize: 2,
      now: () => new Date("2026-05-22T08:00:00Z"),
      downloadArchiveToCache: vi.fn().mockResolvedValue(
        path.join(repoRoot, "data", "osv-bootstrap", "npm", "all.zip"),
      ),
      iterateArchiveEntries: async function* () {
        for (const id of [
          "MAL-2026-4230",
          "MAL-2026-4231",
          "MAL-2026-4232",
        ]) {
          yield {
            entryName: `${id}.json`,
            readText: async () =>
              JSON.stringify({
                schema_version: "1.7.5",
                id,
                published: "2026-05-21T21:15:38Z",
                modified: "2026-05-21T23:01:37.118219322Z",
                summary: "Malicious code in cryptoco-auth (npm)",
                affected: [],
              }),
          }
        }
      },
      deleteCachedFile: vi.fn().mockResolvedValue(undefined),
      upsertNormalizedOsvRecordsBatch,
      upsertSecuritySyncState: vi.fn().mockResolvedValue(undefined),
    })

    expect(upsertNormalizedOsvRecordsBatch).toHaveBeenCalledTimes(2)
    expect(upsertNormalizedOsvRecordsBatch.mock.calls[0]?.[1]).toHaveLength(2)
    expect(upsertNormalizedOsvRecordsBatch.mock.calls[1]?.[1]).toHaveLength(1)
    expect(summary.recordsSeen).toBe(3)
    expect(summary.recordsImported).toBe(3)
    expect(summary.recordsNew).toBe(1)
    expect(summary.recordsChanged).toBe(2)
    expect(summary.recordsSkipped).toBe(0)
    expect(summary.recordsFailed).toBe(0)
  })

  it("surfaces new changed and skipped bootstrap counts in the summary", async () => {
    const repoRoot = fs.mkdtempSync(path.join("/tmp", "vibeguard-osv-bootstrap-"))
    const summary = await bootstrapOsvEcosystem({
      db: {} as never,
      ecosystem: "npm",
      repoRoot,
      batchSize: 3,
      now: () => new Date("2026-05-22T08:00:00Z"),
      downloadArchiveToCache: vi.fn().mockResolvedValue(
        path.join(repoRoot, "data", "osv-bootstrap", "npm", "all.zip"),
      ),
      iterateArchiveEntries: async function* () {
        yield {
          entryName: "MAL-2026-4230.json",
          readText: async () =>
            JSON.stringify({
              schema_version: "1.7.5",
              id: "MAL-2026-4230",
              published: "2026-05-21T21:15:38Z",
              modified: "2026-05-21T23:01:37.118219322Z",
              summary: "Malicious code in cryptoco-auth (npm)",
              affected: [],
            }),
        }
      },
      deleteCachedFile: vi.fn().mockResolvedValue(undefined),
      upsertNormalizedOsvRecordsBatch: vi.fn().mockResolvedValue({
        importedCount: 2,
        newCount: 1,
        changedCount: 1,
        skippedCount: 4,
        results: [],
      }),
      upsertSecuritySyncState: vi.fn().mockResolvedValue(undefined),
    })

    expect(summary.recordsImported).toBe(2)
    expect(summary.recordsNew).toBe(1)
    expect(summary.recordsChanged).toBe(1)
    expect(summary.recordsSkipped).toBe(4)
  })
})

describe("bootstrapAllOsvEcosystems", () => {
  it("bootstraps the four MVP ecosystems with limited concurrency", async () => {
    let active = 0
    let maxActive = 0
    const syncOne = vi.fn().mockImplementation(async ({ ecosystem }) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1

      return {
        ecosystem,
        recordsSeen: 1,
        recordsImported: 1,
        recordsFailed: 0,
        lastProcessedModifiedAt: new Date("2026-05-21T23:01:37.118Z"),
      }
    })

    const results = await bootstrapAllOsvEcosystems({
      db: {} as never,
      concurrency: 2,
      syncOne,
    })

    expect(results.map((result) => result.ecosystem)).toEqual([
      "npm",
      "PyPI",
      "Go",
      "crates.io",
    ])
    expect(syncOne).toHaveBeenCalledTimes(4)
    expect(maxActive).toBeLessThanOrEqual(2)
  })
})
