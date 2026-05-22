import { describe, expect, expectTypeOf, it, vi } from "vitest"

import { checkPackagesAgainstLocalDb } from "../packages/content/src/osv/query"

import {
  buildSecurityCheckRequestBody,
  formatAffectedRanges,
  parseSecurityCheckPayload,
  buildSecurityWorkbenchResultState,
  getSecurityFindingTone,
} from "../apps/web/lib/security-workbench"

type SecurityQueryMock = {
  query: Pick<
    Parameters<typeof checkPackagesAgainstLocalDb>[0]["query"],
    "securitySyncState" | "securityAffectedPackages" | "securityAdvisories"
  >
}

async function buildPackageMatchWithoutVersionPayload() {
  const db = {
    query: {
      securitySyncState: {
        findFirst: vi.fn().mockResolvedValue({
          lastSuccessAt: new Date("2026-05-21T23:00:00Z"),
        }),
      },
      securityAffectedPackages: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "affected-1",
            advisoryId: "advisory-1",
            ecosystem: "npm",
            packageName: "example",
            packageKey: "example",
            purl: "pkg:npm/example",
            affectedVersions: [],
            ranges: [
              {
                type: "ECOSYSTEM",
                events: [{ introduced: "1.0.0" }, { fixed: "1.2.0" }],
              },
            ],
            fixedVersions: ["1.2.0"],
          },
        ]),
      },
      securityAdvisories: {
        findFirst: vi.fn().mockResolvedValue({
          id: "advisory-1",
          source: "osv",
          externalId: "GHSA-example",
          riskType: "vulnerability",
          summary: "Example issue",
          details: null,
          aliases: [],
          severity: [],
          references: [],
          withdrawnAt: null,
          modifiedAt: new Date("2026-05-21T23:01:37Z"),
        }),
      },
    },
  } satisfies SecurityQueryMock

  return checkPackagesAgainstLocalDb(
    db as Parameters<typeof checkPackagesAgainstLocalDb>[0],
    {
    packages: [{ ecosystem: "npm", name: "example" }],
    now: new Date("2026-05-22T08:00:00Z"),
    },
  )
}

describe("security workbench helpers", () => {
  it("builds a single-package request body with a nullable version", () => {
    expect(
      buildSecurityCheckRequestBody({
        ecosystem: "npm",
        name: " example ",
        version: "   ",
      }),
    ).toEqual({
      packages: [{ ecosystem: "npm", name: "example", version: null }],
    })
  })

  it("accepts the real package-check payload shape", () => {
    expectTypeOf<Parameters<typeof buildSecurityWorkbenchResultState>[0]>().toEqualTypeOf<
      Awaited<ReturnType<typeof checkPackagesAgainstLocalDb>>
    >()
  })

  it("rejects malformed success payloads before they reach the workbench state", () => {
    expect(() =>
      parseSecurityCheckPayload({
        meta: {
          source: "local-osv-mirror",
          lastSyncedAt: "2026-05-22T08:00:00.000Z",
          stale: false,
        },
      }),
    ).toThrow("Malformed security check response.")
  })

  it("rejects malformed finding entries before render-time access", () => {
    expect(() =>
      parseSecurityCheckPayload({
        meta: {
          source: "local-osv-mirror",
          lastSyncedAt: "2026-05-22T08:00:00.000Z",
          stale: false,
        },
        findings: [
          {
            affected: false,
            confidence: "low",
            matchReason: "package_match_without_version",
            matchSummary:
              "example matches a known package advisory in the local OSV advisory data, but no package version was provided.",
            package: {
              ecosystem: "npm",
              name: "example",
              version: null,
              purl: "pkg:npm/example",
            },
            advisory: {
              id: "GHSA-example",
              source: "osv",
              riskType: "vulnerability",
              summary: "Example issue",
              details: null,
              aliases: [],
              severity: [],
              references: null,
              modifiedAt: null,
            },
            affectedPackage: {
              affectedVersions: [],
              ranges: [],
              fixedVersions: [],
            },
          },
        ],
      }),
    ).toThrow("Malformed security check response.")
  })

  it("rejects unknown enum-like finding values that drift from the client contract", () => {
    expect(() =>
      parseSecurityCheckPayload({
        meta: {
          source: "local-osv-mirror",
          lastSyncedAt: "2026-05-22T08:00:00.000Z",
          stale: false,
        },
        findings: [
          {
            affected: false,
            confidence: "uncertain",
            matchReason: "package_match_without_version",
            matchSummary:
              "example matches a known package advisory in the local OSV advisory data, but no package version was provided.",
            package: {
              ecosystem: "npm",
              name: "example",
              version: null,
              purl: "pkg:npm/example",
            },
            advisory: {
              id: "GHSA-example",
              source: "osv",
              riskType: "vulnerability",
              summary: "Example issue",
              details: null,
              aliases: [],
              severity: [],
              references: [],
              modifiedAt: null,
            },
            affectedPackage: {
              affectedVersions: [],
              ranges: [],
              fixedVersions: [],
            },
          },
        ],
      }),
    ).toThrow("Malformed security check response.")
  })

  it("rejects malformed nested advisory and range entries", () => {
    expect(() =>
      parseSecurityCheckPayload({
        meta: {
          source: "local-osv-mirror",
          lastSyncedAt: "2026-05-22T08:00:00.000Z",
          stale: false,
        },
        findings: [
          {
            affected: true,
            confidence: "high",
            matchReason: "explicit_affected_version",
            matchSummary:
              "example@1.0.0 is explicitly listed as affected in the local OSV advisory data.",
            package: {
              ecosystem: "npm",
              name: "example",
              version: "1.0.0",
              purl: "pkg:npm/example",
            },
            advisory: {
              id: "GHSA-example",
              source: "osv",
              riskType: "vulnerability",
              summary: "Example issue",
              details: null,
              aliases: [123],
              severity: [[]],
              references: [],
              modifiedAt: null,
            },
            affectedPackage: {
              affectedVersions: [],
              ranges: [[]],
              fixedVersions: [],
            },
          },
        ],
      }),
    ).toThrow("Malformed security check response.")
  })

  it("rejects advisory references with unsafe URL schemes", () => {
    expect(() =>
      parseSecurityCheckPayload({
        meta: {
          source: "local-osv-mirror",
          lastSyncedAt: "2026-05-22T08:00:00.000Z",
          stale: false,
        },
        findings: [
          {
            affected: true,
            confidence: "high",
            matchReason: "explicit_affected_version",
            matchSummary:
              "example@1.0.0 is explicitly listed as affected in the local OSV advisory data.",
            package: {
              ecosystem: "npm",
              name: "example",
              version: "1.0.0",
              purl: "pkg:npm/example",
            },
            advisory: {
              id: "GHSA-example",
              source: "osv",
              riskType: "vulnerability",
              summary: "Example issue",
              details: null,
              aliases: [],
              severity: [],
              references: [{ type: "WEB", url: "javascript:alert(1)" }],
              modifiedAt: null,
            },
            affectedPackage: {
              affectedVersions: [],
              ranges: [],
              fixedVersions: [],
            },
          },
        ],
      }),
    ).toThrow("Malformed security check response.")
  })

  it("rejects contradictory finding states that would render a false negative", () => {
    expect(() =>
      parseSecurityCheckPayload({
        meta: {
          source: "local-osv-mirror",
          lastSyncedAt: "2026-05-22T08:00:00.000Z",
          stale: false,
        },
        findings: [
          {
            affected: false,
            confidence: "high",
            matchReason: "explicit_affected_version",
            matchSummary:
              "example@1.0.0 is explicitly listed as affected in the local OSV advisory data.",
            package: {
              ecosystem: "npm",
              name: "example",
              version: "1.0.0",
              purl: "pkg:npm/example",
            },
            advisory: {
              id: "GHSA-example",
              source: "osv",
              riskType: "vulnerability",
              summary: "Example issue",
              details: null,
              aliases: [],
              severity: [],
              references: [{ type: "WEB", url: "https://example.com/advisory" }],
              modifiedAt: null,
            },
            affectedPackage: {
              affectedVersions: ["1.0.0"],
              ranges: [],
              fixedVersions: [],
            },
          },
        ],
      }),
    ).toThrow("Malformed security check response.")
  })

  it("maps an affected finding to an emphasized tone", () => {
    expect(
      getSecurityFindingTone({
        affected: true,
        confidence: "high",
        matchReason: "explicit_affected_version",
      }),
    ).toBe("hit")
  })

  it("maps the live package-match-without-version case to an inconclusive tone", async () => {
    const payload = await buildPackageMatchWithoutVersionPayload()

    expect(payload.findings[0]?.matchReason).toBe("package_match_without_version")
    expect(
      getSecurityFindingTone(payload.findings[0]),
    ).toBe("inconclusive")
  })

  it("keeps dormant non-affected reasons on a neutral tone if they are surfaced later", () => {
    // checkPackagesAgainstLocalDb currently filters these non-affected reasons out,
    // but the workbench helper keeps an explicit neutral policy if they are surfaced later.
    expect(
      getSecurityFindingTone({
        affected: false,
        matchReason: "version_outside_ecosystem_range",
      }),
    ).toBe("clear")
  })

  it("preserves the full result-state metadata for an empty response", () => {
    expect(
      buildSecurityWorkbenchResultState({
        meta: {
          source: "local-osv-mirror",
          lastSyncedAt: "2026-05-22T08:00:00.000Z",
          stale: false,
        },
        findings: [],
      }),
    ).toEqual({
      empty: true,
      stale: false,
      source: "local-osv-mirror",
      lastSyncedAt: "2026-05-22T08:00:00.000Z",
      findings: [],
    })
  })

  it("propagates stale flag in result state for the live non-affected payload", async () => {
    const payload = await buildPackageMatchWithoutVersionPayload()

    expect(buildSecurityWorkbenchResultState(payload)).toEqual({
      empty: false,
      stale: true,
      source: "local-osv-mirror",
      lastSyncedAt: "2026-05-21T23:00:00.000Z",
      findings: payload.findings,
    })
  })

  it("formats ecosystem range events into human-readable summaries", () => {
    expect(
      formatAffectedRanges([
        {
          type: "ECOSYSTEM",
          events: [{ introduced: "0" }, { fixed: "1.2.0" }],
        },
        {
          type: "ECOSYSTEM",
          events: [{ introduced: "2.0.0" }, { last_affected: "2.4.0" }],
        },
      ]),
    ).toEqual([">= 0, < 1.2.0", ">= 2.0.0, <= 2.4.0"])
  })
})
