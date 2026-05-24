import zlib from "node:zlib";

import { describe, expect, it, vi } from "vitest";

import {
  buildNvdModifiedFeedUrl,
  buildNvdYearFeedUrl,
  fetchSecurityFeedText,
  gunzipSecurityFeedText,
  parseEpssCsv,
  parseKevCatalog,
  parseNvdModifiedFeed,
  syncAllSecurityEnrichmentSources,
  syncNvdFullHistory,
  upsertSecurityCveEnrichments,
} from "../../packages/content/src/security/enrichment";

describe("security enrichment parsers", () => {
  it("normalizes CISA KEV JSON records into CVE enrichment patches", () => {
    expect(
      parseKevCatalog(
        JSON.stringify({
          title: "CISA Catalog of Known Exploited Vulnerabilities",
          catalogVersion: "2026.05.22",
          vulnerabilities: [
            {
              cveID: "CVE-2026-9082",
              vendorProject: "Drupal",
              product: "Core",
              vulnerabilityName: "Drupal Core Vulnerability",
              dateAdded: "2026-05-22",
              dueDate: "2026-05-27",
              knownRansomwareCampaignUse: "Unknown",
              requiredAction: "Apply mitigations.",
              notes: "https://example.test",
              cwes: ["CWE-79"],
            },
          ],
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        cveId: "CVE-2026-9082",
        kevListed: true,
        kevVendorProject: "Drupal",
        kevProduct: "Core",
        kevDueDate: new Date("2026-05-27T00:00:00.000Z"),
        cweIds: ["CWE-79"],
      }),
    ]);
  });

  it("normalizes FIRST EPSS current CSV records and model metadata", () => {
    expect(
      parseEpssCsv(
        [
          "#model_version:v2025.03.14,score_date:2026-05-23T12:55:00Z",
          "cve,epss,percentile",
          "CVE-2026-9082,0.42123,0.97321",
        ].join("\n"),
      ),
    ).toEqual([
      expect.objectContaining({
        cveId: "CVE-2026-9082",
        epss: "0.42123",
        epssPercentile: "0.97321",
        epssScoreDate: new Date("2026-05-23T12:55:00.000Z"),
        epssModelVersion: "v2025.03.14",
      }),
    ]);
  });

  it("normalizes NVD modified feeds into CVSS and CWE enrichment patches", () => {
    expect(buildNvdModifiedFeedUrl()).toBe(
      "https://nvd.nist.gov/feeds/json/cve/2.0/nvdcve-2.0-modified.json.gz",
    );
    expect(buildNvdYearFeedUrl(2026)).toBe(
      "https://nvd.nist.gov/feeds/json/cve/2.0/nvdcve-2.0-2026.json.gz",
    );

    expect(
      parseNvdModifiedFeed({
        vulnerabilities: [
          {
            cve: {
              id: "CVE-2026-9082",
              published: "2026-05-22T18:00:11.503",
              lastModified: "2026-05-23T08:00:01.260",
              descriptions: [
                { lang: "en", value: "A Drupal Core vulnerability." },
              ],
              metrics: {
                cvssMetricV31: [
                  {
                    cvssData: {
                      version: "3.1",
                      vectorString:
                        "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
                      baseScore: 9.8,
                      baseSeverity: "CRITICAL",
                    },
                    exploitabilityScore: 3.9,
                    impactScore: 5.9,
                  },
                ],
              },
              weaknesses: [
                {
                  description: [{ lang: "en", value: "CWE-79" }],
                },
              ],
            },
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        cveId: "CVE-2026-9082",
        description: "A Drupal Core vulnerability.",
        bestCvssScore: "9.8",
        bestCvssSeverity: "CRITICAL",
        cweIds: ["CWE-79"],
      }),
    ]);
  });
});

describe("security enrichment payload limits", () => {
  it("rejects security feed text responses that exceed the byte limit", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("abcdef", {
        status: 200,
      }),
    ) as never;

    try {
      await expect(
        fetchSecurityFeedText("https://example.test/feed.json", 5),
      ).rejects.toThrow(/too large/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects decompressed security feeds that exceed the byte limit", async () => {
    const bytes = zlib.gzipSync(Buffer.from("abcdef", "utf8"));

    await expect(gunzipSecurityFeedText(bytes, "test feed", 5)).rejects.toThrow(
      /too large/,
    );
    await expect(gunzipSecurityFeedText(bytes, "test feed", 6)).resolves.toBe(
      "abcdef",
    );
  });
});

describe("security enrichment sync modes", () => {
  it("uses NVD full history during bootstrap and NVD modified during incremental refreshes", async () => {
    const db = {} as never;
    const syncCisaKevCatalog = vi.fn().mockResolvedValue({
      source: "cisa-kev",
      scope: "global",
      recordsSeen: 1,
      recordsImported: 1,
      recordsFailed: 0,
    });
    const syncFirstEpssScores = vi.fn().mockResolvedValue({
      source: "first-epss",
      scope: "current",
      recordsSeen: 2,
      recordsImported: 2,
      recordsFailed: 0,
    });
    const syncNvdFullHistory = vi.fn().mockResolvedValue({
      source: "nvd",
      scope: "full",
      recordsSeen: 3,
      recordsImported: 3,
      recordsFailed: 0,
    });
    const syncNvdModifiedFeed = vi.fn().mockResolvedValue({
      source: "nvd",
      scope: "modified",
      recordsSeen: 4,
      recordsImported: 4,
      recordsFailed: 0,
    });

    await expect(
      syncAllSecurityEnrichmentSources(db, {
        mode: "bootstrap",
        syncCisaKevCatalog,
        syncFirstEpssScores,
        syncNvdFullHistory,
        syncNvdModifiedFeed,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ source: "cisa-kev", scope: "global" }),
      expect.objectContaining({ source: "first-epss", scope: "current" }),
      expect.objectContaining({ source: "nvd", scope: "full" }),
    ]);

    expect(syncNvdFullHistory).toHaveBeenCalledWith(
      expect.objectContaining({ db }),
    );
    expect(syncNvdModifiedFeed).not.toHaveBeenCalled();

    await syncAllSecurityEnrichmentSources(db, {
      mode: "incremental",
      syncCisaKevCatalog,
      syncFirstEpssScores,
      syncNvdFullHistory,
      syncNvdModifiedFeed,
    });

    expect(syncNvdModifiedFeed).toHaveBeenCalledWith(
      expect.objectContaining({ db }),
    );
    expect(syncNvdFullHistory).toHaveBeenCalledTimes(1);
  });

  it("summarizes and marks NVD full-history bootstrap across annual feeds", async () => {
    const db = {} as never;
    const syncNvdYearFeed = vi.fn().mockImplementation(({ year }) =>
      Promise.resolve({
        source: "nvd",
        scope: `year-${year}`,
        recordsSeen: year === 2025 ? 2 : 3,
        recordsImported: year === 2025 ? 1 : 2,
        recordsFailed: 0,
      }),
    );
    const upsertSecuritySyncState = vi.fn().mockResolvedValue(undefined);
    const now = () => new Date("2026-05-24T08:00:00.000Z");

    await expect(
      syncNvdFullHistory({
        db,
        years: [2025, 2026],
        now,
        syncNvdYearFeed,
        upsertSecuritySyncState,
      }),
    ).resolves.toEqual({
      source: "nvd",
      scope: "full",
      recordsSeen: 5,
      recordsImported: 3,
      recordsFailed: 0,
    });

    expect(syncNvdYearFeed).toHaveBeenCalledTimes(2);
    expect(upsertSecuritySyncState).toHaveBeenLastCalledWith(
      db,
      "full",
      expect.objectContaining({
        source: "nvd",
        status: "success",
        recordsSeen: 5,
        recordsImported: 3,
        recordsFailed: 0,
        cursorJson: expect.objectContaining({
          mode: "bootstrap",
          years: [2025, 2026],
        }),
      }),
    );
  });
});

describe("upsertSecurityCveEnrichments", () => {
  it("merges source-specific enrichment patches by CVE id", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const db = { insert } as never;

    await upsertSecurityCveEnrichments(
      db,
      [
        {
          cveId: "CVE-2026-9082",
          kevListed: true,
          kevVendorProject: "Drupal",
        },
      ],
      { table: "security_cve_enrichments" as never },
    );

    expect(insert).toHaveBeenCalledWith("security_cve_enrichments");
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        cveId: "CVE-2026-9082",
        kevListed: true,
        kevVendorProject: "Drupal",
      }),
    ]);
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });

  it("writes large enrichment imports in bounded batches", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const db = { insert } as never;

    await upsertSecurityCveEnrichments(
      db,
      [
        { cveId: "CVE-2026-0001", epss: "0.10000" },
        { cveId: "CVE-2026-0002", epss: "0.20000" },
        { cveId: "CVE-2026-0003", epss: "0.30000" },
      ],
      {
        table: "security_cve_enrichments" as never,
        batchSize: 2,
      },
    );

    expect(values).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({ cveId: "CVE-2026-0001" }),
      expect.objectContaining({ cveId: "CVE-2026-0002" }),
    ]);
    expect(values).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({ cveId: "CVE-2026-0003" }),
    ]);
  });
});
