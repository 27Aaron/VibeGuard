import { describe, expect, it, vi } from "vitest"

import {
  buildPackageMatchSummary,
  buildPackageCheckMeta,
  checkPackagesAgainstLocalDb,
} from "../../packages/content/src/osv/query"

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
          findMany: vi.fn().mockResolvedValue([
            {
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
            },
          ]),
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
          findMany: vi.fn().mockResolvedValue([
            {
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
            },
          ]),
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

  it("sorts findings by advisory update time and exposes advisory timestamps", async () => {
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
              id: "affected-old",
              advisoryId: "advisory-old",
              ecosystem: "npm",
              packageName: "axios",
              packageKey: "axios",
              purl: "pkg:npm/axios",
              affectedVersions: [],
              ranges: [
                {
                  type: "SEMVER",
                  events: [{ introduced: "0" }, { fixed: "0.28.0" }],
                },
              ],
              fixedVersions: ["0.28.0"],
            },
            {
              id: "affected-new",
              advisoryId: "advisory-new",
              ecosystem: "npm",
              packageName: "axios",
              packageKey: "axios",
              purl: "pkg:npm/axios",
              affectedVersions: [],
              ranges: [
                {
                  type: "SEMVER",
                  events: [{ introduced: "0" }, { fixed: "0.31.0" }],
                },
              ],
              fixedVersions: ["0.31.0"],
            },
          ]),
        },
        securityAdvisories: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "advisory-old",
              source: "osv",
              externalId: "GHSA-old",
              riskType: "vulnerability",
              summary: "Older axios advisory",
              details: null,
              aliases: [],
              severity: [],
              references: [],
              withdrawnAt: null,
              publishedAt: new Date("2023-11-08T12:00:00Z"),
              modifiedAt: new Date("2026-02-04T02:41:22Z"),
            },
            {
              id: "advisory-new",
              source: "osv",
              externalId: "GHSA-new",
              riskType: "vulnerability",
              summary: "Newer axios advisory",
              details: null,
              aliases: [],
              severity: [],
              references: [],
              withdrawnAt: null,
              publishedAt: new Date("2026-04-09T15:16:08Z"),
              modifiedAt: new Date("2026-05-21T20:38:54Z"),
            },
          ]),
        },
      },
    } as never

    const result = await checkPackagesAgainstLocalDb(db, {
      packages: [{ ecosystem: "npm", name: "axios", version: "0.21.1" }],
    })

    expect(result.findings.map((finding) => finding.advisory.id)).toEqual([
      "GHSA-new",
      "GHSA-old",
    ])
    expect(result.findings[0]?.advisory).toMatchObject({
      publishedAt: "2026-04-09T15:16:08.000Z",
      modifiedAt: "2026-05-21T20:38:54.000Z",
    })
  })

  it("enriches advisory CVE aliases with local KEV, EPSS, NVD, and risk signals", async () => {
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
              ecosystem: "npm",
              packageName: "axios",
              packageKey: "axios",
              purl: "pkg:npm/axios",
              affectedVersions: [],
              ranges: [
                {
                  type: "SEMVER",
                  events: [{ introduced: "1.0.0" }, { fixed: "1.12.0" }],
                },
              ],
              fixedVersions: ["1.12.0"],
            },
          ]),
        },
        securityAdvisories: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "advisory-1",
              source: "osv",
              externalId: "GHSA-axios",
              riskType: "vulnerability",
              summary: "Axios vulnerability",
              details: null,
              aliases: ["GHSA-axios", "CVE-2026-42044"],
              severity: [],
              references: [],
              withdrawnAt: null,
              modifiedAt: new Date("2026-05-21T23:01:37Z"),
            },
          ]),
        },
        securityCveEnrichments: {
          findMany: vi.fn().mockResolvedValue([
            {
              cveId: "CVE-2026-42044",
              title: "Axios vulnerability",
              description: "Axios allows a crafted input issue.",
              cvssMetrics: [
                {
                  source: "nvd",
                  version: "3.1",
                  vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                  baseScore: "9.8",
                  baseSeverity: "CRITICAL",
                },
              ],
              bestCvssScore: "9.8",
              bestCvssSeverity: "CRITICAL",
              cweIds: ["CWE-79"],
              epss: "0.42",
              epssPercentile: "0.97",
              epssScoreDate: new Date("2026-05-23T12:55:00Z"),
              epssModelVersion: "v2025.03.14",
              kevListed: true,
              kevDateAdded: new Date("2026-05-22T00:00:00Z"),
              kevDueDate: new Date("2026-06-12T00:00:00Z"),
              kevKnownRansomwareCampaignUse: "Unknown",
              kevRequiredAction: "Apply mitigations.",
              kevVendorProject: "Axios",
              kevProduct: "axios",
              nvdPublishedAt: new Date("2026-05-22T18:00:11Z"),
              nvdModifiedAt: new Date("2026-05-23T08:00:01Z"),
              updatedAt: new Date("2026-05-23T13:00:00Z"),
            },
          ]),
        },
      },
    } as never

    const result = await checkPackagesAgainstLocalDb(db, {
      packages: [{ ecosystem: "npm", name: "axios", version: "1.6.0" }],
    })

    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      advisory: {
        aliases: ["GHSA-axios", "CVE-2026-42044"],
      },
      cveEnrichments: [
        {
          cveId: "CVE-2026-42044",
          bestCvssScore: "9.8",
          bestCvssSeverity: "CRITICAL",
          epss: "0.42",
          epssPercentile: "0.97",
          kevListed: true,
        },
      ],
      risk: {
        level: "critical",
        score: 100,
        signals: expect.arrayContaining([
          "affected_version_match",
          "cisa_kev",
          "epss_high_percentile",
          "cvss_critical",
        ]),
      },
    })
    expect(db.query.securityCveEnrichments.findMany).toHaveBeenCalledTimes(1)
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
          findMany: vi.fn().mockResolvedValue([
            {
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
            },
          ]),
        },
      },
    } as never

    const result = await checkPackagesAgainstLocalDb(db, {
      packages: [{ ecosystem: "npm", name: "left-pad", version: "1.0.0" }],
    })

    expect(result.findings).toEqual([])
  })
})
