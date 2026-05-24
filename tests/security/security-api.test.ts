import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSecurityPackageProfileSummary,
  normalizeSecurityCveId,
  parseSecurityAdvisoryListParams,
} from "../../apps/web/lib/security-api";

const packageCheckPayload = {
  meta: {
    source: "local-osv-mirror",
    lastSyncedAt: "2026-05-24T01:00:00.000Z",
    stale: false,
  },
  findings: [
    {
      affected: true,
      confidence: "high",
      matchReason: "version_in_ecosystem_range",
      matchSummary: "axios@1.0.0 falls inside an affected npm version range.",
      package: {
        ecosystem: "npm",
        name: "axios",
        version: "1.0.0",
        purl: "pkg:npm/axios",
      },
      advisory: {
        id: "GHSA-3p68-rc4w-qgx5",
        source: "osv",
        sourceUrl: "https://osv.dev/vulnerability/GHSA-3p68-rc4w-qgx5",
        riskType: "vulnerability",
        summary: "Axios SSRF via NO_PROXY normalization",
        details: "Details",
        aliases: ["CVE-2025-62718"],
        related: [],
        upstream: [],
        severity: [],
        references: [],
        maliciousOrigins: [],
        publishedAt: "2026-04-10T01:32:00.000Z",
        modifiedAt: "2026-05-22T04:38:00.000Z",
        withdrawnAt: null,
      },
      affectedPackage: {
        affectedVersions: [],
        ranges: [
          {
            type: "SEMVER",
            events: [{ introduced: "1.0.0" }, { fixed: "1.15.0" }],
          },
        ],
        fixedVersions: ["1.15.0", "0.31.0"],
      },
      cveEnrichments: [
        {
          cveId: "CVE-2025-62718",
          title: null,
          description: null,
          cvssMetrics: [],
          bestCvssScore: "9.9",
          bestCvssSeverity: "CRITICAL",
          cweIds: ["CWE-918"],
          epss: "0.21",
          epssPercentile: "0.95",
          epssScoreDate: "2026-05-22T00:00:00.000Z",
          epssModelVersion: "v2026.01",
          kevListed: true,
          kevDateAdded: "2026-05-23T00:00:00.000Z",
          kevDueDate: null,
          kevKnownRansomwareCampaignUse: "Unknown",
          kevRequiredAction: "Apply updates",
          kevVendorProject: "Axios",
          kevProduct: "axios",
          kevNotes: null,
          nvdPublishedAt: "2026-04-10T00:00:00.000Z",
          nvdModifiedAt: "2026-05-23T06:00:00.000Z",
        },
      ],
      risk: {
        level: "critical",
        score: 95,
        signals: ["affected_version_match", "cisa_kev"],
      },
    },
    {
      affected: false,
      confidence: "low",
      matchReason: "package_match_without_version",
      matchSummary: "axios matches a package advisory without version.",
      package: {
        ecosystem: "npm",
        name: "axios",
        version: null,
        purl: "pkg:npm/axios",
      },
      advisory: {
        id: "GHSA-43fc-jf86-j433",
        source: "osv",
        sourceUrl: "https://osv.dev/vulnerability/GHSA-43fc-jf86-j433",
        riskType: "vulnerability",
        summary: "Axios DoS via proto key",
        details: null,
        aliases: ["CVE-2026-25639"],
        related: [],
        upstream: [],
        severity: [],
        references: [],
        maliciousOrigins: [],
        publishedAt: "2026-02-10T01:46:00.000Z",
        modifiedAt: "2026-05-22T04:13:00.000Z",
        withdrawnAt: null,
      },
      affectedPackage: {
        affectedVersions: [],
        ranges: [],
        fixedVersions: ["1.13.5"],
      },
      cveEnrichments: [],
      risk: {
        level: "low",
        score: 32,
        signals: ["package_match_without_version", "fixed_version_available"],
      },
    },
  ],
};

describe("security API helpers", () => {
  it("parses advisory list filters with safe defaults", () => {
    const params = parseSecurityAdvisoryListParams(
      new URLSearchParams({
        q: " axios ",
        ecosystem: "npm",
        package: " Axios ",
        cve: "cve-2025-62718",
        riskType: "vulnerability",
        kev: "true",
        withdrawn: "false",
        cvssMin: "9",
        epssMin: "0.9",
        updatedAfter: "2026-05-01T00:00:00.000Z",
        limit: "500",
        page: "0",
      }),
    );

    expect(params).toEqual({
      q: "axios",
      ecosystem: "npm",
      packageName: "Axios",
      cve: "CVE-2025-62718",
      riskType: "vulnerability",
      kev: true,
      withdrawn: false,
      cvssMin: 9,
      epssMin: 0.9,
      updatedAfter: "2026-05-01T00:00:00.000Z",
      limit: 100,
      page: 1,
    });
  });

  it("normalizes CVE identifiers and rejects invalid ids", () => {
    expect(normalizeSecurityCveId(" cve-2026-25639 ")).toBe("CVE-2026-25639");
    expect(normalizeSecurityCveId("GHSA-43fc-jf86-j433")).toBeNull();
  });

  it("builds package profile summary from package check findings", () => {
    expect(
      buildSecurityPackageProfileSummary(packageCheckPayload.findings as never),
    ).toEqual({
      totalFindings: 2,
      affectedCount: 1,
      inconclusiveCount: 0,
      highestRisk: {
        level: "critical",
        score: 95,
      },
      latestUpdatedAt: "2026-05-23T06:00:00.000Z",
      recommendedFixedVersions: ["1.15.0", "0.31.0", "1.13.5"],
    });
  });
});

describe("security API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T01:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a package profile for ecosystem and package path", async () => {
    const db = {
      query: {
        securitySyncState: {
          findFirst: vi.fn().mockResolvedValue({
            lastSuccessAt: new Date("2026-05-24T01:00:00.000Z"),
          }),
        },
        securityAffectedPackages: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "affected-1",
              ecosystem: "npm",
              packageName: "@scope/axios",
              packageKey: "@scope/axios",
              purl: "pkg:npm/%40scope/axios",
              affectedVersions: [],
              ranges: [
                {
                  type: "SEMVER",
                  events: [{ introduced: "1.0.0" }, { fixed: "1.15.0" }],
                },
              ],
              fixedVersions: ["1.15.0"],
              advisoryId: "advisory-1",
            },
          ]),
        },
        securityAdvisories: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "advisory-1",
              source: "osv",
              externalId: "GHSA-3p68-rc4w-qgx5",
              sourceUrl: "https://osv.dev/vulnerability/GHSA-3p68-rc4w-qgx5",
              riskType: "vulnerability",
              summary: "Axios SSRF via NO_PROXY normalization",
              details: "Details",
              aliases: ["CVE-2025-62718"],
              relatedIds: [],
              upstreamIds: [],
              severity: [],
              references: [],
              maliciousOrigins: [],
              publishedAt: new Date("2026-04-10T01:32:00.000Z"),
              modifiedAt: new Date("2026-05-22T04:38:00.000Z"),
              withdrawnAt: null,
            },
          ]),
        },
        securityCveEnrichments: {
          findMany: vi.fn().mockResolvedValue([
            {
              cveId: "CVE-2025-62718",
              title: null,
              description: null,
              cvssMetrics: [],
              bestCvssScore: "9.9",
              bestCvssSeverity: "CRITICAL",
              cweIds: ["CWE-918"],
              epss: "0.21",
              epssPercentile: "0.95",
              epssScoreDate: new Date("2026-05-22T00:00:00.000Z"),
              epssModelVersion: "v2026.01",
              kevListed: true,
              kevDateAdded: new Date("2026-05-23T00:00:00.000Z"),
              kevDueDate: null,
              kevKnownRansomwareCampaignUse: "Unknown",
              kevRequiredAction: "Apply updates",
              kevVendorProject: "Axios",
              kevProduct: "axios",
              kevNotes: null,
              nvdPublishedAt: new Date("2026-04-10T00:00:00.000Z"),
              nvdModifiedAt: new Date("2026-05-23T06:00:00.000Z"),
            },
          ]),
        },
      },
    };
    const getDb = vi.fn(() => db);

    vi.doMock("@vibeguard/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@vibeguard/db")>()),
      getDb,
    }));

    const { GET } =
      await import("../../apps/web/app/api/security/packages/[ecosystem]/[...packageName]/route");
    const response = await GET(
      new Request(
        "http://vibeguard.test/api/security/packages/npm/@scope/axios?version=1.0.0",
      ),
      {
        params: Promise.resolve({
          ecosystem: "npm",
          packageName: ["@scope", "axios"],
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      package: {
        ecosystem: "npm",
        name: "@scope/axios",
        version: "1.0.0",
      },
      summary: {
        totalFindings: 1,
        affectedCount: 1,
        inconclusiveCount: 0,
        recommendedFixedVersions: ["1.15.0"],
      },
      findings: [
        {
          package: {
            ecosystem: "npm",
            name: "@scope/axios",
            version: "1.0.0",
          },
          advisory: {
            id: "GHSA-3p68-rc4w-qgx5",
            aliases: ["CVE-2025-62718"],
          },
          cveEnrichments: [
            {
              cveId: "CVE-2025-62718",
              bestCvssScore: "9.9",
              kevListed: true,
            },
          ],
        },
      ],
    });
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(db.query.securityAffectedPackages.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns sync status for all security data sources", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        source: "osv",
        scope: "npm",
        status: "success",
        lastProcessedModifiedAt: new Date("2026-05-23T22:00:00.000Z"),
        cursorJson: { last: "GHSA-1" },
        lastStartedAt: new Date("2026-05-24T00:00:00.000Z"),
        lastSuccessAt: new Date("2026-05-24T00:05:00.000Z"),
        lastError: null,
        recordsSeen: 10,
        recordsImported: 8,
        recordsFailed: 0,
        updatedAt: new Date("2026-05-24T00:05:00.000Z"),
      },
    ]);
    const getDb = vi.fn(() => ({
      query: {
        securitySyncState: { findMany },
      },
    }));

    vi.doMock("@vibeguard/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@vibeguard/db")>()),
      getDb,
    }));

    const { GET } =
      await import("../../apps/web/app/api/security/sync/status/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      meta: {
        sourceCount: 1,
        staleAfterMs: 10_800_000,
      },
      items: [
        {
          source: "osv",
          scope: "npm",
          status: "success",
          lastProcessedModifiedAt: "2026-05-23T22:00:00.000Z",
          cursorJson: { last: "GHSA-1" },
          lastStartedAt: "2026-05-24T00:00:00.000Z",
          lastSuccessAt: "2026-05-24T00:05:00.000Z",
          lastError: null,
          recordsSeen: 10,
          recordsImported: 8,
          recordsFailed: 0,
          updatedAt: "2026-05-24T00:05:00.000Z",
          stale: false,
        },
      ],
    });
  });

  it("lists advisories with CVE enrichment and package impact", async () => {
    const selectFromWhere = vi.fn().mockResolvedValue([
      { cveId: "CVE-2025-62718" },
    ]);
    const selectFrom = vi.fn().mockReturnValue({ where: selectFromWhere });
    const selectChain = { from: selectFrom };
    const countSelectFromWhere = vi.fn().mockResolvedValue([{ count: 1 }]);
    const countSelectFrom = vi.fn().mockReturnValue({ where: countSelectFromWhere });
    const countSelectChain = { from: countSelectFrom };

    let selectCallIndex = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCallIndex += 1;
        return selectCallIndex === 1 ? selectChain : countSelectChain;
      }),
      query: {
        securityAdvisories: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "advisory-1",
              source: "osv",
              externalId: "GHSA-3p68-rc4w-qgx5",
              sourceUrl: "https://osv.dev/vulnerability/GHSA-3p68-rc4w-qgx5",
              riskType: "vulnerability",
              summary: "Axios SSRF via NO_PROXY normalization",
              details: "Details",
              aliases: ["CVE-2025-62718"],
              relatedIds: ["GHSA-related"],
              upstreamIds: [],
              severity: [],
              references: [],
              maliciousOrigins: [],
              publishedAt: new Date("2026-04-10T01:32:00.000Z"),
              modifiedAt: new Date("2026-05-22T04:38:00.000Z"),
              withdrawnAt: null,
              createdAt: new Date("2026-04-10T01:32:00.000Z"),
            },
          ]),
        },
        securityCveEnrichments: {
          findMany: vi.fn().mockResolvedValue([
            {
              cveId: "CVE-2025-62718",
              title: null,
              description: null,
              cvssMetrics: [],
              bestCvssScore: "9.9",
              bestCvssSeverity: "CRITICAL",
              cweIds: ["CWE-918"],
              epss: "0.21",
              epssPercentile: "0.95",
              epssScoreDate: new Date("2026-05-22T00:00:00.000Z"),
              epssModelVersion: "v2026.01",
              kevListed: true,
              kevDateAdded: new Date("2026-05-23T00:00:00.000Z"),
              kevDueDate: null,
              kevKnownRansomwareCampaignUse: "Unknown",
              kevRequiredAction: "Apply updates",
              kevVendorProject: "Axios",
              kevProduct: "axios",
              kevNotes: null,
              nvdPublishedAt: new Date("2026-04-10T00:00:00.000Z"),
              nvdModifiedAt: new Date("2026-05-23T06:00:00.000Z"),
            },
          ]),
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
              ranges: [{ type: "SEMVER", events: [{ introduced: "1.0.0" }] }],
              fixedVersions: ["1.15.0"],
            },
          ]),
        },
      },
    };
    const getDb = vi.fn(() => db);

    vi.doMock("@vibeguard/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@vibeguard/db")>()),
      getDb,
    }));

    const { GET } =
      await import("../../apps/web/app/api/security/advisories/route");
    const response = await GET(
      new Request(
        "http://vibeguard.test/api/security/advisories?riskType=vulnerability&kev=true",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      meta: {
        riskType: "vulnerability",
        kev: true,
        totalCount: 1,
      },
      items: [
        {
          id: "GHSA-3p68-rc4w-qgx5",
          aliases: ["CVE-2025-62718"],
          related: ["GHSA-related"],
          cveEnrichments: [{ cveId: "CVE-2025-62718", kevListed: true }],
          packageImpacts: [{ ecosystem: "npm", packageName: "axios" }],
        },
      ],
    });
  });

  it("returns one advisory by external id", async () => {
    const db = {
      query: {
        securityAdvisories: {
          findFirst: vi.fn().mockResolvedValue({
            id: "advisory-1",
            source: "osv",
            externalId: "GHSA-43fc-jf86-j433",
            sourceUrl: "https://osv.dev/vulnerability/GHSA-43fc-jf86-j433",
            riskType: "vulnerability",
            summary: "Axios DoS via proto key",
            details: "Details",
            aliases: ["CVE-2026-25639"],
            relatedIds: [],
            upstreamIds: [],
            severity: [],
            references: [],
            maliciousOrigins: [],
            publishedAt: new Date("2026-02-10T01:46:00.000Z"),
            modifiedAt: new Date("2026-05-22T04:13:00.000Z"),
            withdrawnAt: null,
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
              ranges: [],
              fixedVersions: ["1.13.5"],
            },
          ]),
        },
        securityCveEnrichments: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    const getDb = vi.fn(() => db);

    vi.doMock("@vibeguard/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@vibeguard/db")>()),
      getDb,
    }));

    const { GET } =
      await import("../../apps/web/app/api/security/advisories/[advisoryId]/route");
    const response = await GET(
      new Request(
        "http://vibeguard.test/api/security/advisories/GHSA-43fc-jf86-j433",
      ),
      {
        params: Promise.resolve({ advisoryId: "GHSA-43fc-jf86-j433" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "GHSA-43fc-jf86-j433",
      aliases: ["CVE-2026-25639"],
      packageImpacts: [{ ecosystem: "npm", fixedVersions: ["1.13.5"] }],
    });
  });

  it("returns CVE enrichment with related advisories", async () => {
    const cveRow = {
      cveId: "CVE-2026-25639",
      title: "Axios DoS",
      description: "Axios denial of service",
      cvssMetrics: [],
      bestCvssScore: "7.5",
      bestCvssSeverity: "HIGH",
      cweIds: ["CWE-400"],
      epss: "0.14",
      epssPercentile: "0.82",
      epssScoreDate: new Date("2026-05-22T00:00:00.000Z"),
      epssModelVersion: "v2026.01",
      kevListed: false,
      kevDateAdded: null,
      kevDueDate: null,
      kevKnownRansomwareCampaignUse: null,
      kevRequiredAction: null,
      kevVendorProject: null,
      kevProduct: null,
      kevNotes: null,
      nvdPublishedAt: new Date("2026-02-10T00:00:00.000Z"),
      nvdModifiedAt: new Date("2026-05-22T04:13:00.000Z"),
    };
    const db = {
      query: {
        securityCveEnrichments: {
          findFirst: vi.fn().mockResolvedValue(cveRow),
        },
        securityAdvisories: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "advisory-1",
              source: "osv",
              externalId: "GHSA-43fc-jf86-j433",
              sourceUrl: "https://osv.dev/vulnerability/GHSA-43fc-jf86-j433",
              riskType: "vulnerability",
              summary: "Axios DoS via proto key",
              details: null,
              aliases: ["CVE-2026-25639"],
              relatedIds: [],
              upstreamIds: [],
              severity: [],
              references: [],
              maliciousOrigins: [],
              publishedAt: new Date("2026-02-10T01:46:00.000Z"),
              modifiedAt: new Date("2026-05-22T04:13:00.000Z"),
              withdrawnAt: null,
            },
          ]),
        },
        securityAffectedPackages: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    const getDb = vi.fn(() => db);

    vi.doMock("@vibeguard/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@vibeguard/db")>()),
      getDb,
    }));

    const { GET } =
      await import("../../apps/web/app/api/security/cves/[cveId]/route");
    const response = await GET(
      new Request("http://vibeguard.test/api/security/cves/CVE-2026-25639"),
      {
        params: Promise.resolve({ cveId: "cve-2026-25639" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      cveId: "CVE-2026-25639",
      enrichment: {
        bestCvssScore: "7.5",
        epssPercentile: "0.82",
      },
      advisories: [{ id: "GHSA-43fc-jf86-j433" }],
    });
  });
});
