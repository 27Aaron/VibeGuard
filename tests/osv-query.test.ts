import { describe, expect, it, vi } from "vitest"

import {
  buildPackageCheckMeta,
  checkPackagesAgainstLocalDb,
} from "../packages/content/src/osv/query"

describe("buildPackageCheckMeta", () => {
  it("marks stale local mirrors without triggering network fallback", () => {
    const now = new Date("2026-05-22T08:00:00Z")

    expect(
      buildPackageCheckMeta({
        now,
        lastSyncedAt: new Date("2026-05-22T07:00:00Z"),
        staleAfterMs: 6 * 60 * 60 * 1000,
      }),
    ).toMatchObject({
      source: "local-osv-mirror",
      stale: false,
    })

    expect(
      buildPackageCheckMeta({
        now,
        lastSyncedAt: new Date("2026-05-21T23:00:00Z"),
        staleAfterMs: 6 * 60 * 60 * 1000,
      }),
    ).toMatchObject({
      source: "local-osv-mirror",
      stale: true,
      warning: "Local OSV mirror is stale; run the OSV sync job.",
    })
  })
})

describe("checkPackagesAgainstLocalDb", () => {
  it("queries local tables only and matches explicitly affected versions", async () => {
    const db = {
      query: {
        securitySyncState: {
          findFirst: vi.fn().mockResolvedValue({
            lastSuccessAt: new Date("2026-05-22T07:00:00Z"),
          }),
        },
        securityAffectedPackages: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "affected-1",
              ecosystem: "npm",
              packageName: "cryptoco-auth",
              packageKey: "cryptoco-auth",
              purl: "pkg:npm/cryptoco-auth",
              affectedVersions: ["1.0.0", "1.0.1"],
              ranges: [],
              fixedVersions: [],
              advisoryId: "advisory-1",
            },
          ]),
        },
        securityAdvisories: {
          findFirst: vi.fn().mockResolvedValue({
            id: "advisory-1",
            source: "osv",
            externalId: "MAL-2026-4230",
            riskType: "malicious-package",
            summary: "Malicious code in cryptoco-auth (npm)",
            details: "The package shipped malicious install behavior.",
            aliases: [],
            severity: [],
            references: [],
            withdrawnAt: null,
            modifiedAt: new Date("2026-05-21T23:01:37Z"),
          }),
        },
      },
    } as never

    const result = await checkPackagesAgainstLocalDb(db, {
      packages: [{ ecosystem: "npm", name: "cryptoco-auth", version: "1.0.1" }],
      now: new Date("2026-05-22T08:00:00Z"),
    })

    expect(result.meta.source).toBe("local-osv-mirror")
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      affected: true,
      advisory: {
        id: "MAL-2026-4230",
        riskType: "malicious-package",
      },
      package: {
        ecosystem: "npm",
        name: "cryptoco-auth",
        version: "1.0.1",
      },
    })
    expect(db.query.securityAffectedPackages.findMany).toHaveBeenCalledTimes(1)
  })
})
