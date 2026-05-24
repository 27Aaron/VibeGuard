import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { checkPackagesAgainstLocalDb } from "@vibeguard/content/osv/query";
import {
  schema,
  securityAffectedPackages,
  securityAdvisories,
  securityCveEnrichments,
  securitySyncState,
} from "@vibeguard/db";
import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  SECURITY_RISK_TYPE_VALUES,
  type SecurityPackageEcosystem,
  type SecurityRiskType,
} from "@vibeguard/shared";

type ContentDb = NodePgDatabase<typeof schema>;
type SecurityCheckPayload = Awaited<
  ReturnType<typeof checkPackagesAgainstLocalDb>
>;
type SecurityFinding = SecurityCheckPayload["findings"][number];

export const SECURITY_API_DEFAULT_LIMIT = 20;
export const SECURITY_API_MAX_LIMIT = 100;
export const SECURITY_API_STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export type SecurityAdvisoryListParams = {
  q: string;
  ecosystem: SecurityPackageEcosystem | null;
  packageName: string;
  cve: string | null;
  riskType: SecurityRiskType | null;
  kev: boolean | null;
  withdrawn: boolean | null;
  cvssMin: number | null;
  epssMin: number | null;
  updatedAfter: string | null;
  limit: number;
  page: number;
};

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function optionalNumber(raw: string | null) {
  if (!raw?.trim()) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalBoolean(raw: string | null) {
  if (raw === null) return null;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return null;
}

function optionalDateIso(raw: string | null) {
  if (!raw?.trim()) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function dateToIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function timestampFromIso(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberFromDecimal(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSupportedEcosystem(
  value: string,
): value is SecurityPackageEcosystem {
  return SECURITY_PACKAGE_ECOSYSTEM_VALUES.includes(
    value as SecurityPackageEcosystem,
  );
}

function isSupportedRiskType(value: string): value is SecurityRiskType {
  return SECURITY_RISK_TYPE_VALUES.includes(value as SecurityRiskType);
}

export function normalizeSecurityCveId(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^CVE-\d{4}-\d{4,}$/.test(normalized) ? normalized : null;
}

export function parseSecurityAdvisoryListParams(
  searchParams: URLSearchParams,
): SecurityAdvisoryListParams {
  const ecosystemParam = searchParams.get("ecosystem")?.trim() ?? "";
  const riskTypeParam = searchParams.get("riskType")?.trim() ?? "";

  return {
    q: searchParams.get("q")?.trim() ?? "",
    ecosystem: isSupportedEcosystem(ecosystemParam) ? ecosystemParam : null,
    packageName: searchParams.get("package")?.trim() ?? "",
    cve: normalizeSecurityCveId(searchParams.get("cve") ?? ""),
    riskType: isSupportedRiskType(riskTypeParam) ? riskTypeParam : null,
    kev: optionalBoolean(searchParams.get("kev")),
    withdrawn: optionalBoolean(searchParams.get("withdrawn")),
    cvssMin: optionalNumber(searchParams.get("cvssMin")),
    epssMin: optionalNumber(searchParams.get("epssMin")),
    updatedAfter: optionalDateIso(searchParams.get("updatedAfter")),
    limit: clampInt(
      searchParams.get("limit"),
      SECURITY_API_DEFAULT_LIMIT,
      1,
      SECURITY_API_MAX_LIMIT,
    ),
    page: clampInt(searchParams.get("page"), 1, 1, 10_000),
  };
}

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

export async function getSecuritySyncStatus(
  db: ContentDb,
  options: {
    now?: Date;
    staleAfterMs?: number;
  } = {},
) {
  const now = options.now ?? new Date();
  const staleAfterMs = options.staleAfterMs ?? SECURITY_API_STALE_AFTER_MS;
  const rows = await db.query.securitySyncState.findMany({
    orderBy: [desc(securitySyncState.updatedAt)],
  });

  const items = rows.map((row) => {
    const lastSuccessAt = row.lastSuccessAt;
    const stale =
      !lastSuccessAt || now.getTime() - lastSuccessAt.getTime() > staleAfterMs;

    return {
      source: row.source,
      scope: row.scope,
      status: row.status,
      lastProcessedModifiedAt: dateToIso(row.lastProcessedModifiedAt),
      cursorJson: row.cursorJson,
      lastStartedAt: dateToIso(row.lastStartedAt),
      lastSuccessAt: dateToIso(row.lastSuccessAt),
      lastError: row.lastError,
      recordsSeen: row.recordsSeen,
      recordsImported: row.recordsImported,
      recordsFailed: row.recordsFailed,
      updatedAt: dateToIso(row.updatedAt),
      stale,
    };
  });

  return {
    meta: {
      sourceCount: items.length,
      staleAfterMs,
    },
    items,
  };
}

function formatCveEnrichment(row: typeof securityCveEnrichments.$inferSelect) {
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

function extractCveAliases(ids: string[]) {
  return Array.from(
    new Set(
      ids
        .map((id) => id.trim().toUpperCase())
        .filter((id) => /^CVE-\d{4}-\d{4,}$/.test(id)),
    ),
  );
}

function normalizePackageKey(
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

function advisoryTimestamp(advisory: {
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

function formatSecurityAdvisory(
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

export async function listSecurityAdvisories(
  db: ContentDb,
  searchParams: URLSearchParams,
) {
  const params = parseSecurityAdvisoryListParams(searchParams);

  // Build base WHERE conditions pushed to SQL
  const conditions = [];

  // Package/ecosystem filter via affected_packages join
  let packageAdvisoryIds: Set<string> | null = null;
  if (params.ecosystem || params.packageName) {
    const packageRows = await db.query.securityAffectedPackages.findMany({
      where: (table, { and, eq: whereEq }) => {
        const filters = [
          params.ecosystem
            ? whereEq(table.ecosystem, params.ecosystem)
            : undefined,
          params.packageName && params.ecosystem
            ? whereEq(
                table.packageKey,
                normalizePackageKey(params.ecosystem, params.packageName),
              )
            : undefined,
        ].filter((filter): filter is NonNullable<typeof filter> =>
          Boolean(filter),
        );

        return filters.length > 0 ? and(...filters) : undefined;
      },
    });
    packageAdvisoryIds = new Set(packageRows.map((row) => row.advisoryId));

    if (packageAdvisoryIds.size === 0) {
      return {
        meta: { ...params, count: 0, totalCount: 0, totalPages: 1 },
        items: [],
      };
    }

    conditions.push(inArray(securityAdvisories.id, [...packageAdvisoryIds]));
  }

  if (params.riskType) {
    conditions.push(eq(securityAdvisories.riskType, params.riskType));
  }

  if (params.withdrawn !== null) {
    conditions.push(
      params.withdrawn
        ? isNotNull(securityAdvisories.withdrawnAt)
        : isNull(securityAdvisories.withdrawnAt),
    );
  }

  if (params.cve) {
    const cveJson = JSON.stringify([params.cve]);
    conditions.push(
      or(
        sql`${securityAdvisories.aliases} @> ${cveJson}::jsonb`,
        sql`${securityAdvisories.upstreamIds} @> ${cveJson}::jsonb`,
      )!,
    );
  }

  if (params.updatedAfter) {
    conditions.push(
      sql`coalesce(${securityAdvisories.modifiedAt}, ${securityAdvisories.publishedAt}) >= ${params.updatedAfter}::timestamptz`,
    );
  }

  if (params.q) {
    const pattern = `%${params.q}%`;
    conditions.push(
      or(
        sql`${securityAdvisories.externalId} ilike ${pattern}`,
        sql`${securityAdvisories.summary} ilike ${pattern}`,
        sql`${securityAdvisories.details} ilike ${pattern}`,
      )!,
    );
  }

  // Enrichment-based filters (kev, cvssMin, epssMin): find qualifying CVE IDs first
  let enrichmentCveIds: Set<string> | null = null;
  if (params.kev !== null || params.cvssMin !== null || params.epssMin !== null) {
    const enrichmentConditions = [];
    if (params.kev === true) {
      enrichmentConditions.push(eq(securityCveEnrichments.kevListed, true));
    } else if (params.kev === false) {
      enrichmentConditions.push(sql`coalesce(${securityCveEnrichments.kevListed}, false) = false`);
    }
    if (params.cvssMin !== null) {
      enrichmentConditions.push(
        sql`coalesce(${securityCveEnrichments.bestCvssScore}::numeric, 0) >= ${params.cvssMin}`,
      );
    }
    if (params.epssMin !== null) {
      enrichmentConditions.push(
        sql`coalesce(${securityCveEnrichments.epssPercentile}::numeric, 0) >= ${params.epssMin}`,
      );
    }

    const qualifyingCveRows = await db
      .select({ cveId: securityCveEnrichments.cveId })
      .from(securityCveEnrichments)
      .where(
        enrichmentConditions.length === 1
          ? enrichmentConditions[0]
          : and(...enrichmentConditions),
      );
    enrichmentCveIds = new Set(qualifyingCveRows.map((r) => r.cveId));

    if (enrichmentCveIds.size === 0) {
      return {
        meta: { ...params, count: 0, totalCount: 0, totalPages: 1 },
        items: [],
      };
    }

    // Advisory must have at least one alias/upstreamId matching these CVE IDs
    const cveArray = [...enrichmentCveIds];
    conditions.push(
      or(
        sql`exists (select 1 from jsonb_array_elements_text(${securityAdvisories.aliases}) elem where elem = any(${cveArray}))`,
        sql`exists (select 1 from jsonb_array_elements_text(${securityAdvisories.upstreamIds}) elem where elem = any(${cveArray}))`,
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Count first, then fetch page with corrected offset
  const [countRows] = await db
    .select({ count: sql<number>`count(*)` })
    .from(securityAdvisories)
    .where(where);

  const totalCount = Number(countRows?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / params.limit));
  const page = Math.min(params.page, totalPages);
  const offset = (page - 1) * params.limit;

  const rows = await db.query.securityAdvisories.findMany({
    where,
    orderBy: [desc(securityAdvisories.modifiedAt)],
    limit: params.limit,
    offset,
  });

  const pageAdvisoryIds = rows.map((row) => row.id);

  // Fetch packages and enrichments only for the current page
  const [packageRows, cveRows] = await Promise.all([
    pageAdvisoryIds.length > 0
      ? db.query.securityAffectedPackages.findMany({
          where: inArray(securityAffectedPackages.advisoryId, pageAdvisoryIds),
        })
      : [],
    (async () => {
      const cveIds = Array.from(
        new Set(
          rows.flatMap((row) =>
            extractCveAliases([...row.aliases, ...row.upstreamIds]),
          ),
        ),
      );
      return cveIds.length > 0
        ? db.query.securityCveEnrichments.findMany({
            where: inArray(securityCveEnrichments.cveId, cveIds),
          })
        : [];
    })(),
  ]);

  const packagesByAdvisoryId = new Map<string, typeof packageRows>();
  for (const row of packageRows) {
    packagesByAdvisoryId.set(row.advisoryId, [
      ...(packagesByAdvisoryId.get(row.advisoryId) ?? []),
      row,
    ]);
  }
  const enrichmentByCve = new Map(
    cveRows.map((row) => [row.cveId, formatCveEnrichment(row)]),
  );

  return {
    meta: {
      ...params,
      page,
      count: rows.length,
      totalCount,
      totalPages,
    },
    items: rows.map((row) => {
      const rowCves = extractCveAliases([...row.aliases, ...row.upstreamIds]);
      const enrichments = rowCves.flatMap((cveId) => {
        const enrichment = enrichmentByCve.get(cveId);
        return enrichment ? [enrichment] : [];
      });

      return formatSecurityAdvisory(
        row,
        packagesByAdvisoryId.get(row.id) ?? [],
        enrichments,
      );
    }),
  };
}

export async function getSecurityAdvisoryDetail(
  db: ContentDb,
  advisoryId: string,
) {
  const normalizedId = advisoryId.trim();
  const advisory = await db.query.securityAdvisories.findFirst({
    where: eq(securityAdvisories.externalId, normalizedId),
  });

  if (!advisory) {
    return null;
  }

  const [packageRows, cveRows] = await Promise.all([
    db.query.securityAffectedPackages.findMany({
      where: eq(securityAffectedPackages.advisoryId, advisory.id),
    }),
    db.query.securityCveEnrichments.findMany({
      where: inArray(
        securityCveEnrichments.cveId,
        extractCveAliases([...advisory.aliases, ...advisory.upstreamIds]),
      ),
    }),
  ]);

  return formatSecurityAdvisory(
    advisory,
    packageRows,
    cveRows.map(formatCveEnrichment),
  );
}

export async function getSecurityCveDetail(db: ContentDb, cveId: string) {
  const normalizedCveId = normalizeSecurityCveId(cveId);

  if (!normalizedCveId) {
    return null;
  }

  const enrichment = await db.query.securityCveEnrichments.findFirst({
    where: eq(securityCveEnrichments.cveId, normalizedCveId),
  });
  const advisoryRows = await db.query.securityAdvisories.findMany({
    where: sql`${securityAdvisories.aliases} @> ${JSON.stringify([normalizedCveId])}::jsonb OR ${securityAdvisories.upstreamIds} @> ${JSON.stringify([normalizedCveId])}::jsonb`,
    orderBy: [desc(securityAdvisories.modifiedAt)],
  });
  const relatedAdvisories = advisoryRows;
  const advisoryIds = relatedAdvisories.map((advisory) => advisory.id);
  const packageRows =
    advisoryIds.length > 0
      ? await db.query.securityAffectedPackages.findMany({
          where: inArray(securityAffectedPackages.advisoryId, advisoryIds),
        })
      : [];
  const packagesByAdvisoryId = new Map<string, typeof packageRows>();
  for (const row of packageRows) {
    packagesByAdvisoryId.set(row.advisoryId, [
      ...(packagesByAdvisoryId.get(row.advisoryId) ?? []),
      row,
    ]);
  }

  if (!enrichment && relatedAdvisories.length === 0) {
    return null;
  }

  return {
    cveId: normalizedCveId,
    enrichment: enrichment ? formatCveEnrichment(enrichment) : null,
    advisories: relatedAdvisories.map((advisory) =>
      formatSecurityAdvisory(
        advisory,
        packagesByAdvisoryId.get(advisory.id) ?? [],
        enrichment ? [formatCveEnrichment(enrichment)] : [],
      ),
    ),
  };
}
