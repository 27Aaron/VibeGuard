import { describe, expect, it, vi } from "vitest"

import {
  buildPackageMatchSummary,
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
        staleAfterMs: 3 * 60 * 60 * 1000,
      }),
    ).toMatchObject({
      source: "local-osv-mirror",
      stale: false,
    })

    expect(
      buildPackageCheckMeta({
        now,
        lastSyncedAt: new Date("2026-05-21T23:00:00Z"),
        staleAfterMs: 3 * 60 * 60 * 1000,
      }),
    ).toMatchObject({
      source: "local-osv-mirror",
      stale: true,
    })
  })
})

describe("buildPackageMatchSummary", () => {
  it("describes explicit version hits in plain language", () => {
    expect(
      buildPackageMatchSummary({
        affected: true,
        confidence: "high",
        matchReason: "explicit_affected_version",
        ecosystem: "npm",
        name: "cryptoco-auth",
        version: "1.0.1",
      }),
    ).toBe(
      "cryptoco-auth@1.0.1 is explicitly listed as affected in the local OSV advisory data.",
    )
  })

  it("describes range-based hits in plain language", () => {
    expect(
      buildPackageMatchSummary({
        affected: true,
        confidence: "high",
        matchReason: "version_in_ecosystem_range",
        ecosystem: "go",
        name: "example.com/mod",
        version: "v1.1.0",
      }),
    ).toBe(
      "example.com/mod@v1.1.0 falls inside an affected Go version range in the local OSV advisory data.",
    )
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
      confidence: "high",
      matchReason: "explicit_affected_version",
      matchSummary:
        "cryptoco-auth@1.0.1 is explicitly listed as affected in the local OSV advisory data.",
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

  it("matches range-only affected packages and returns structured reasoning", async () => {
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
              advisoryId: "advisory-1",
              ecosystem: "go",
              packageName: "example.com/mod",
              packageKey: "example.com/mod",
              purl: "pkg:golang/example.com/mod",
              affectedVersions: [],
              ranges: [
                {
                  type: "ECOSYSTEM",
                  events: [{ introduced: "v1.0.0" }, { fixed: "v1.2.0" }],
                },
              ],
              fixedVersions: ["v1.2.0"],
            },
          ]),
        },
        securityAdvisories: {
          findFirst: vi.fn().mockResolvedValue({
            id: "advisory-1",
            source: "osv",
            externalId: "GHSA-test",
            riskType: "vulnerability",
            summary: "Range-only advisory",
            details: null,
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
      packages: [{ ecosystem: "go", name: "example.com/mod", version: "v1.1.0" }],
    })

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      affected: true,
      confidence: "high",
      matchReason: "version_in_ecosystem_range",
      matchSummary:
        "example.com/mod@v1.1.0 falls inside an affected Go version range in the local OSV advisory data.",
      package: {
        ecosystem: "go",
        name: "example.com/mod",
        version: "v1.1.0",
      },
    })
  })

  it("skips withdrawn advisories even when the version matches", async () => {
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
              advisoryId: "advisory-withdrawn",
              ecosystem: "npm",
              packageName: "left-pad",
              packageKey: "left-pad",
              purl: "pkg:npm/left-pad",
              affectedVersions: ["1.0.0"],
              ranges: [],
              fixedVersions: [],
            },
          ]),
        },
        securityAdvisories: {
          findFirst: vi.fn().mockResolvedValue({
            id: "advisory-withdrawn",
            source: "osv",
            externalId: "GHSA-withdrawn",
            riskType: "vulnerability",
            summary: "Withdrawn advisory",
            details: null,
            aliases: [],
            severity: [],
            references: [],
            withdrawnAt: new Date("2026-05-22T01:00:00Z"),
            modifiedAt: new Date("2026-05-21T23:01:37Z"),
          }),
        },
      },
    } as never

    const result = await checkPackagesAgainstLocalDb(db, {
      packages: [{ ecosystem: "npm", name: "left-pad", version: "1.0.0" }],
    })

    expect(result.findings).toEqual([])
  })
})
