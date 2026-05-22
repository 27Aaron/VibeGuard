import { describe, expect, it, vi } from "vitest"

import { SecuritySyncStatus } from "@vibeguard/shared"

import {
  buildSecurityAdvisoryInsert,
  buildSecurityAffectedPackageInsert,
  buildSecuritySyncStateUpdate,
  upsertNormalizedOsvRecord,
  upsertNormalizedOsvRecordsBatch,
} from "../packages/content/src/osv/store"

const advisory = {
  source: "osv" as const,
  externalId: "MAL-2026-4230",
  sourceUrl:
    "https://storage.googleapis.com/osv-vulnerabilities/npm/MAL-2026-4230.json",
  rawHash: "sha256:test",
  riskType: "malicious-package" as const,
  summary: "Malicious code in cryptoco-auth (npm)",
  details: "The package shipped malicious install behavior.",
  aliases: [],
  severity: [],
  publishedAt: new Date("2026-05-21T21:15:38Z"),
  modifiedAt: new Date("2026-05-21T23:01:37Z"),
  withdrawnAt: null,
  references: [],
}

const affectedPackage = {
  ecosystem: "npm" as const,
  packageName: "cryptoco-auth",
  packageKey: "cryptoco-auth",
  purl: "pkg:npm/cryptoco-auth",
  affectedVersions: ["1.0.0", "1.0.1"],
  ranges: [],
  fixedVersions: [],
}

describe("OSV store payload builders", () => {
  it("builds an advisory insert with only the product-facing OSV fields", () => {
    expect(buildSecurityAdvisoryInsert(advisory)).toMatchObject({
      externalId: "MAL-2026-4230",
      sourceUrl:
        "https://storage.googleapis.com/osv-vulnerabilities/npm/MAL-2026-4230.json",
      rawHash: "sha256:test",
      riskType: "malicious-package",
      summary: "Malicious code in cryptoco-auth (npm)",
    })
  })

  it("builds affected package inserts linked to the advisory", () => {
    expect(
      buildSecurityAffectedPackageInsert(affectedPackage, "advisory-1"),
    ).toMatchObject({
      advisoryId: "advisory-1",
      ecosystem: "npm",
      packageKey: "cryptoco-auth",
      affectedVersions: ["1.0.0", "1.0.1"],
    })
  })

  it("builds sync state updates for success and failure", () => {
    const now = new Date("2026-05-22T00:00:00Z")

    expect(
      buildSecuritySyncStateUpdate({
        status: SecuritySyncStatus.SUCCESS,
        now,
        lastProcessedModifiedAt: new Date("2026-05-21T23:01:37Z"),
        recordsSeen: 5,
        recordsImported: 4,
        recordsFailed: 1,
      }),
    ).toMatchObject({
      status: "success",
      lastSuccessAt: now,
      lastError: null,
      recordsSeen: 5,
      recordsImported: 4,
      recordsFailed: 1,
    })

    expect(
      buildSecuritySyncStateUpdate({
        status: SecuritySyncStatus.FAILED,
        now,
        lastError: "network failed",
      }),
    ).toMatchObject({
      status: "failed",
      lastError: "network failed",
      recordsFailed: 1,
    })
  })
})

describe("upsertNormalizedOsvRecord", () => {
  it("upserts advisory and refreshed affected packages", async () => {
    const calls: string[] = []
    const deleteWhere = vi.fn().mockResolvedValue(undefined)
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
      insert: vi.fn((table) => ({
        values: vi.fn((values) => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              { id: "advisory-1", externalId: "MAL-2026-4230" },
            ]),
          })),
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "affected-1", ...values }]),
          })),
        })),
      })),
      delete: vi.fn(() => {
        calls.push("delete-affected")
        return { where: deleteWhere }
      }),
    } as never

    const result = await upsertNormalizedOsvRecord(
      db,
      {
        advisory,
        affectedPackages: [affectedPackage],
      },
      {
        tables: {
          securityAdvisories: "advisory",
          securityAffectedPackages: "affected",
        } as never,
      },
    )

    expect(result).toEqual({
      advisoryId: "advisory-1",
      affectedPackageCount: 1,
      skipped: false,
      writeKind: "new",
    })
    expect(calls).toEqual(["delete-affected"])
  })

  it("skips affected package rewrites when the advisory hash is unchanged", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              id: "advisory-1",
              externalId: "MAL-2026-4230",
              rawHash: "sha256:test",
            },
          ]),
        })),
      })),
      insert: vi.fn(),
      delete: vi.fn(),
    } as never

    const result = await upsertNormalizedOsvRecord(db, {
      advisory,
      affectedPackages: [affectedPackage],
    })

    expect(result).toEqual({
      advisoryId: "advisory-1",
      affectedPackageCount: 1,
      skipped: true,
      writeKind: null,
    })
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
  })
})

describe("upsertNormalizedOsvRecordsBatch", () => {
  it("batch-loads existing hashes, skips unchanged advisories, and rewrites only changed rows", async () => {
    const advisoryValuesCalls: unknown[] = []
    const affectedValuesCalls: unknown[] = []
    const deleteWhere = vi.fn().mockResolvedValue(undefined)
    const advisoryReturning = [
      {
        id: "advisory-changed",
        source: "osv",
        externalId: "GHSA-changed",
        rawHash: "sha256:new",
      },
      {
        id: "advisory-new",
        source: "osv",
        externalId: "GHSA-new",
        rawHash: "sha256:new-new",
      },
    ]
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            {
              id: "advisory-changed",
              externalId: "GHSA-changed",
              rawHash: "sha256:old",
            },
            {
              id: "advisory-unchanged",
              externalId: "GHSA-unchanged",
              rawHash: "sha256:same",
            },
          ]),
        })),
      })),
      insert: vi.fn((table) => ({
        values: vi.fn((values) => {
          if (table === "advisory") {
            advisoryValuesCalls.push(values)
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue(advisoryReturning),
              })),
            }
          }

          affectedValuesCalls.push(values)
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue(values),
            })),
          }
        }),
      })),
      delete: vi.fn(() => ({
        where: deleteWhere,
      })),
    } as never

    const changedRecord = {
      advisory: {
        ...advisory,
        externalId: "GHSA-changed",
        rawHash: "sha256:new",
      },
      affectedPackages: [affectedPackage],
    }
    const unchangedRecord = {
      advisory: {
        ...advisory,
        externalId: "GHSA-unchanged",
        rawHash: "sha256:same",
      },
      affectedPackages: [affectedPackage],
    }
    const newRecord = {
      advisory: {
        ...advisory,
        externalId: "GHSA-new",
        rawHash: "sha256:new-new",
      },
      affectedPackages: [
        {
          ...affectedPackage,
          packageName: "boxlite",
          packageKey: "boxlite",
          purl: "pkg:pypi/boxlite",
          ecosystem: "pypi" as const,
        },
      ],
    }

    const result = await upsertNormalizedOsvRecordsBatch(
      db,
      [changedRecord, unchangedRecord, newRecord],
      {
        tables: {
          securityAdvisories: "advisory",
          securityAffectedPackages: "affected",
        } as never,
      },
    )

    expect(result.importedCount).toBe(2)
    expect(result.newCount).toBe(1)
    expect(result.changedCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(result.results).toEqual([
      {
        advisoryId: "advisory-changed",
        affectedPackageCount: 1,
        skipped: false,
        writeKind: "changed",
      },
      {
        advisoryId: "advisory-unchanged",
        affectedPackageCount: 1,
        skipped: true,
        writeKind: null,
      },
      {
        advisoryId: "advisory-new",
        affectedPackageCount: 1,
        skipped: false,
        writeKind: "new",
      },
    ])
    expect(db.select).toHaveBeenCalledTimes(1)
    expect(advisoryValuesCalls).toHaveLength(1)
    expect(advisoryValuesCalls[0]).toHaveLength(2)
    expect(deleteWhere).toHaveBeenCalledTimes(1)
    expect(affectedValuesCalls).toHaveLength(1)
    expect(affectedValuesCalls[0]).toHaveLength(2)
  })

  it("chunks affected package inserts to keep single SQL payloads smaller", async () => {
    const affectedValuesCalls: unknown[] = []
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
      insert: vi.fn((table) => ({
        values: vi.fn((values) => {
          if (table === "advisory") {
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([
                  { id: "advisory-1", externalId: "GHSA-many" },
                ]),
              })),
            }
          }

          affectedValuesCalls.push(values)
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue(values),
            })),
          }
        }),
      })),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    } as never

    await upsertNormalizedOsvRecordsBatch(
      db,
      [
        {
          advisory: {
            ...advisory,
            externalId: "GHSA-many",
            rawHash: "sha256:many",
          },
          affectedPackages: [
            affectedPackage,
            {
              ...affectedPackage,
              packageName: "cryptoco-auth-2",
              packageKey: "cryptoco-auth-2",
              purl: "pkg:npm/cryptoco-auth-2",
            },
          ],
        },
      ],
      {
        tables: {
          securityAdvisories: "advisory",
          securityAffectedPackages: "affected",
        } as never,
        affectedPackageInsertChunkSize: 1,
      },
    )

    expect(affectedValuesCalls).toHaveLength(2)
    expect(affectedValuesCalls[0]).toHaveLength(1)
    expect(affectedValuesCalls[1]).toHaveLength(1)
  })
})
