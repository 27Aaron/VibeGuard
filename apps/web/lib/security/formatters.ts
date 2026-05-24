import type { SecurityPackageEcosystem } from "@vibeguard/shared";

import { schema } from "@vibeguard/db";

export function dateToIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

export function timestampFromIso(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizePackageKey(
  ecosystem: SecurityPackageEcosystem,
  name: string,
) {
  const trimmed = name.trim();

  if (ecosystem === "pypi") {
    return trimmed.toLowerCase().replace(/[-_.]+/g, "-");
  }

  if (ecosystem === "npm" || ecosystem === "crates-io") {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

export function extractCveAliases(ids: string[]) {
  return Array.from(
    new Set(
      ids
        .map((id) => id.trim().toUpperCase())
        .filter((id) => /^CVE-\d{4}-\d{4,}$/.test(id)),
    ),
  );
}

export function advisoryTimestamp(advisory: {
  withdrawnAt?: Date | null;
  modifiedAt?: Date | null;
  publishedAt?: Date | null;
  createdAt?: Date | null;
}) {
  return Math.max(
    advisory.withdrawnAt?.getTime() ?? 0,
    advisory.modifiedAt?.getTime() ?? 0,
    advisory.publishedAt?.getTime() ?? 0,
    advisory.createdAt?.getTime() ?? 0,
  );
}

export function formatCveEnrichment(row: typeof schema.securityCveEnrichments.$inferSelect) {
  return {
    cveId: row.cveId,
    title: row.title,
    description: row.description,
    cvssMetrics: row.cvssMetrics,
    bestCvssScore: row.bestCvssScore,
    bestCvssSeverity: row.bestCvssSeverity,
    cweIds: row.cweIds,
    epss: row.epss,
    epssPercentile: row.epssPercentile,
    epssScoreDate: dateToIso(row.epssScoreDate),
    epssModelVersion: row.epssModelVersion,
    kevListed: row.kevListed,
    kevDateAdded: dateToIso(row.kevDateAdded),
    kevDueDate: dateToIso(row.kevDueDate),
    kevKnownRansomwareCampaignUse: row.kevKnownRansomwareCampaignUse,
    kevRequiredAction: row.kevRequiredAction,
    kevVendorProject: row.kevVendorProject,
    kevProduct: row.kevProduct,
    kevNotes: row.kevNotes,
    nvdPublishedAt: dateToIso(row.nvdPublishedAt),
    nvdModifiedAt: dateToIso(row.nvdModifiedAt),
  };
}

export function formatSecurityAdvisory(
  advisory: typeof schema.securityAdvisories.$inferSelect,
  packageImpacts: Array<typeof schema.securityAffectedPackages.$inferSelect>,
  cveEnrichments: Array<ReturnType<typeof formatCveEnrichment>>,
) {
  return {
    id: advisory.externalId,
    source: advisory.source,
    sourceUrl: advisory.sourceUrl,
    riskType:
      advisory.riskType === "malicious-package" &&
      !/^MAL-/i.test(advisory.externalId) &&
      advisory.maliciousOrigins.length === 0
        ? "vulnerability"
        : advisory.riskType,
    summary: advisory.summary,
    details: advisory.details,
    aliases: advisory.aliases,
    related: advisory.relatedIds,
    upstream: advisory.upstreamIds,
    severity: advisory.severity,
    references: advisory.references,
    maliciousOrigins: advisory.maliciousOrigins,
    publishedAt: dateToIso(advisory.publishedAt),
    modifiedAt: dateToIso(advisory.modifiedAt),
    withdrawnAt: dateToIso(advisory.withdrawnAt),
    packageImpacts: packageImpacts.map((impact) => ({
      ecosystem: impact.ecosystem,
      packageName: impact.packageName,
      packageKey: impact.packageKey,
      purl: impact.purl,
      affectedVersions: impact.affectedVersions,
      ranges: impact.ranges,
      fixedVersions: impact.fixedVersions,
    })),
    cveEnrichments,
  };
}
