import { describe, expect, it } from "vitest"

import {
  calculateSecurityFindingRisk,
  extractCveAliases,
} from "../../packages/content/src/security/risk"

describe("security finding risk", () => {
  it("extracts only CVE aliases from mixed OSV aliases", () => {
    expect(
      extractCveAliases([
        "GHSA-3p68-rc4w-qgx5",
        " cve-2025-62718 ",
        "PYSEC-2026-1",
        "CVE-2026-42044",
      ]),
    ).toEqual(["CVE-2025-62718", "CVE-2026-42044"])
  })

  it("prioritizes known exploitation over static severity", () => {
    expect(
      calculateSecurityFindingRisk({
        affected: true,
        confidence: "high",
        fixedVersions: ["1.2.0"],
        cveEnrichments: [
          {
            cveId: "CVE-2026-1000",
            bestCvssScore: "6.5",
            bestCvssSeverity: "MEDIUM",
            epss: "0.12",
            epssPercentile: "0.88",
            kevListed: true,
            kevKnownRansomwareCampaignUse: "Known",
          },
        ],
      }),
    ).toMatchObject({
      level: "critical",
      score: 95,
      signals: expect.arrayContaining([
        "affected_version_match",
        "cisa_kev",
        "ransomware_campaign",
      ]),
    })
  })

  it("keeps low-confidence package-only matches below confirmed version hits", () => {
    expect(
      calculateSecurityFindingRisk({
        affected: false,
        confidence: "low",
        fixedVersions: [],
        cveEnrichments: [
          {
            cveId: "CVE-2026-2000",
            bestCvssScore: "9.8",
            bestCvssSeverity: "CRITICAL",
            epss: "0.01",
            epssPercentile: "0.60",
            kevListed: false,
            kevKnownRansomwareCampaignUse: null,
          },
        ],
      }),
    ).toMatchObject({
      level: "medium",
      score: 48,
      signals: expect.arrayContaining([
        "package_match_without_version",
        "cvss_critical",
        "no_fixed_version",
      ]),
    })
  })
})
