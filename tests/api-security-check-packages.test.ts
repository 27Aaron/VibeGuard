import { describe, expect, it, vi } from "vitest"

import {
  parseSecurityPackageCheckBody,
  SECURITY_PACKAGE_CHECK_MAX_PACKAGES,
} from "../apps/web/lib/api-security"

describe("parseSecurityPackageCheckBody", () => {
  it("normalizes supported package coordinates for local security checks", () => {
    expect(
      parseSecurityPackageCheckBody({
        packages: [
          {
            ecosystem: "npm",
            name: "  @Scope/Package  ",
            version: "  1.0.0  ",
          },
          {
            ecosystem: "pypi",
            name: " Django ",
          },
        ],
      }),
    ).toEqual({
      ok: true,
      packages: [
        { ecosystem: "npm", name: "@Scope/Package", version: "1.0.0" },
        { ecosystem: "pypi", name: "Django", version: null },
      ],
    })
  })

  it("rejects invalid package check requests", () => {
    expect(parseSecurityPackageCheckBody({ packages: [] })).toEqual({
      ok: false,
      message: "packages must include at least one package.",
    })
    expect(
      parseSecurityPackageCheckBody({
        packages: [{ ecosystem: "maven", name: "spring-core" }],
      }),
    ).toEqual({
      ok: false,
      message: "packages[0].ecosystem must be one of npm, pypi, go, crates-io.",
    })
    expect(
      parseSecurityPackageCheckBody({
        packages: Array.from(
          { length: SECURITY_PACKAGE_CHECK_MAX_PACKAGES + 1 },
          () => ({ ecosystem: "npm", name: "left-pad" }),
        ),
      }),
    ).toEqual({
      ok: false,
      message: `packages cannot contain more than ${SECURITY_PACKAGE_CHECK_MAX_PACKAGES} packages.`,
    })
  })
})

describe("POST /api/security/check/packages", () => {
  it("checks packages against the local database mirror", async () => {
    vi.resetModules()
    const db = {
      query: {
        securitySyncState: {
          findFirst: vi.fn().mockResolvedValue({
            lastSuccessAt: new Date("2026-05-22T08:00:00.000Z"),
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
    }
    const getDb = vi.fn(() => db)

    vi.doMock("@vibeguard/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@vibeguard/db")>()),
      getDb,
    }))

    const { POST } = await import(
      "../apps/web/app/api/security/check/packages/route"
    )
    const response = await POST(
      new Request("http://vibeguard.test/api/security/check/packages", {
        method: "POST",
        body: JSON.stringify({
          packages: [{ ecosystem: "npm", name: "cryptoco-auth", version: "1.0.1" }],
        }),
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      meta: {
        source: "local-osv-mirror",
        lastSyncedAt: "2026-05-22T08:00:00.000Z",
        stale: false,
        warning: null,
      },
      findings: [
        {
          affected: true,
          confidence: "high",
          matchReason: "explicit_affected_version",
          matchSummary:
            "cryptoco-auth@1.0.1 is explicitly listed as affected in the local OSV advisory data.",
          package: {
            ecosystem: "npm",
            name: "cryptoco-auth",
            version: "1.0.1",
            purl: "pkg:npm/cryptoco-auth",
          },
          advisory: {
            id: "MAL-2026-4230",
            source: "osv",
            riskType: "malicious-package",
            summary: "Malicious code in cryptoco-auth (npm)",
            details: "The package shipped malicious install behavior.",
            aliases: [],
            severity: [],
            references: [],
            modifiedAt: "2026-05-21T23:01:37.000Z",
          },
          affectedPackage: {
            affectedVersions: ["1.0.0", "1.0.1"],
            ranges: [],
            fixedVersions: [],
          },
        },
      ],
    })
    expect(getDb).toHaveBeenCalledTimes(1)
    expect(db.query.securityAffectedPackages.findMany).toHaveBeenCalledTimes(1)
  })

  it("returns 400 for invalid package check requests", async () => {
    vi.resetModules()
    vi.doMock("@vibeguard/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@vibeguard/db")>()),
      getDb: vi.fn(),
    }))

    const { POST } = await import(
      "../apps/web/app/api/security/check/packages/route"
    )
    const response = await POST(
      new Request("http://vibeguard.test/api/security/check/packages", {
        method: "POST",
        body: JSON.stringify({
          packages: [{ ecosystem: "npm", name: "" }],
        }),
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "packages[0].name is required.",
    })
  })
})

describe("GET /api/security/check/overview", () => {
  it("returns per-ecosystem totals for the public package-check surface", async () => {
    vi.resetModules()
    const groupBy = vi.fn().mockResolvedValue([
      { ecosystem: "npm", count: 49313 },
      { ecosystem: "pypi", count: 8123 },
      { ecosystem: "go", count: 2455 },
      { ecosystem: "crates-io", count: 3659 },
    ])
    const from = vi.fn(() => ({ groupBy }))
    const select = vi.fn(() => ({ from }))
    const getDb = vi.fn(() => ({ select }))

    vi.doMock("@vibeguard/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@vibeguard/db")>()),
      getDb,
    }))

    const { GET } = await import(
      "../apps/web/app/api/security/check/overview/route"
    )
    const response = await GET(
      new Request("http://vibeguard.test/api/security/check/overview"),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      totals: {
        npm: 49313,
        pypi: 8123,
        go: 2455,
        "crates-io": 3659,
      },
    })
    expect(getDb).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledTimes(1)
    expect(groupBy).toHaveBeenCalledTimes(1)
  })
})
