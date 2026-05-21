import { describe, expect, it, vi } from "vitest"

import { SecurityParseStatus, SecuritySyncStatus } from "@vibeguard/shared"

import {
  buildSecurityAdvisoryInsert,
  buildSecurityAffectedPackageInsert,
  buildSecuritySourceRecordInsert,
  buildSecuritySyncStateUpdate,
  upsertNormalizedOsvRecord,
} from "../packages/content/src/osv/store"

const sourceRecord = {
  source: "osv" as const,
  externalId: "MAL-2026-4230",
  sourceUrl:
    "https://storage.googleapis.com/osv-vulnerabilities/npm/MAL-2026-4230.json",
  sourceEcosystems: ["npm"] as const,
  schemaVersion: "1.7.5",
  modifiedAt: new Date("2026-05-21T23:01:37Z"),
  publishedAt: new Date("2026-05-21T21:15:38Z"),
  withdrawnAt: null,
  rawHash: "sha256:test",
  rawSizeBytes: 1499,
  syncedAt: new Date("2026-05-22T00:00:00Z"),
  parseStatus: SecurityParseStatus.PARSED,
  parseError: null,
}

const advisory = {
  source: "osv" as const,
  externalId: "MAL-2026-4230",
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
  it("builds a source record insert without raw JSON", () => {
    const result = buildSecuritySourceRecordInsert(sourceRecord)

    expect(result).toMatchObject({
      externalId: "MAL-2026-4230",
      parseStatus: "parsed",
      rawHash: "sha256:test",
      rawSizeBytes: 1499,
    })
    expect(result).not.toHaveProperty("rawJson")
  })

  it("builds an advisory insert linked to the source record", () => {
    expect(buildSecurityAdvisoryInsert(advisory, "source-record-1")).toMatchObject({
      sourceRecordId: "source-record-1",
      externalId: "MAL-2026-4230",
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
  it("upserts source, advisory, and refreshed affected packages", async () => {
    const calls: string[] = []
    const deleteWhere = vi.fn().mockResolvedValue(undefined)
    const db = {
      insert: vi.fn((table) => ({
        values: vi.fn((values) => ({
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              table === "source"
                ? { id: "source-record-1", ...values }
                : { id: "advisory-1", ...values },
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
        sourceRecord,
        advisory,
        affectedPackages: [affectedPackage],
      },
      {
        tables: {
          securitySourceRecords: "source",
          securityAdvisories: "advisory",
          securityAffectedPackages: "affected",
        } as never,
      },
    )

    expect(result).toEqual({
      sourceRecordId: "source-record-1",
      advisoryId: "advisory-1",
      affectedPackageCount: 1,
    })
    expect(calls).toEqual(["delete-affected"])
  })
})
