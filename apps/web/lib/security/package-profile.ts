import { checkPackagesAgainstLocalDb } from "@vibeguard/content/osv/query";
import type { SecurityPackageEcosystem } from "@vibeguard/shared";

import type { ContentDb, SecurityFinding } from "./constants";
import { timestampFromIso } from "./formatters";

function latestFindingTimestamp(finding: SecurityFinding) {
  return Math.max(
    timestampFromIso(finding.advisory.withdrawnAt),
    timestampFromIso(finding.advisory.modifiedAt),
    timestampFromIso(finding.advisory.publishedAt),
    ...finding.cveEnrichments.flatMap((cve) => [
      timestampFromIso(cve.nvdModifiedAt),
      timestampFromIso(cve.nvdPublishedAt),
      timestampFromIso(cve.epssScoreDate),
      timestampFromIso(cve.kevDateAdded),
    ]),
  );
}

export function buildSecurityPackageProfileSummary(
  findings: SecurityFinding[],
) {
  const highestRiskFinding = findings
    .filter((finding) => finding.risk)
    .sort((left, right) => right.risk.score - left.risk.score)[0];
  const latestUpdatedAt = Math.max(0, ...findings.map(latestFindingTimestamp));
  const recommendedFixedVersions = Array.from(
    new Set(
      findings.flatMap((finding) => finding.affectedPackage.fixedVersions),
    ),
  );

  return {
    totalFindings: findings.length,
    affectedCount: findings.filter((finding) => finding.affected).length,
    inconclusiveCount: findings.filter(
      (finding) => !finding.affected && finding.confidence === "undetermined",
    ).length,
    highestRisk: highestRiskFinding
      ? {
          level: highestRiskFinding.risk.level,
          score: highestRiskFinding.risk.score,
        }
      : null,
    latestUpdatedAt:
      latestUpdatedAt > 0 ? new Date(latestUpdatedAt).toISOString() : null,
    recommendedFixedVersions,
  };
}

export async function getSecurityPackageProfile(
  db: ContentDb,
  input: {
    ecosystem: SecurityPackageEcosystem;
    name: string;
    version?: string | null;
  },
) {
  const payload = await checkPackagesAgainstLocalDb(db, {
    packages: [
      {
        ecosystem: input.ecosystem,
        name: input.name,
        version: input.version ?? null,
      },
    ],
  });

  return {
    package: {
      ecosystem: input.ecosystem,
      name: input.name,
      version: input.version ?? null,
    },
    meta: payload.meta,
    summary: buildSecurityPackageProfileSummary(payload.findings),
    findings: payload.findings,
  };
}
