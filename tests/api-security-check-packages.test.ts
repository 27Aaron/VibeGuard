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
          findMany: vi.fn().mockResolvedValue([]),
        },
        securityAdvisories: {
          findFirst: vi.fn(),
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
      findings: [],
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
