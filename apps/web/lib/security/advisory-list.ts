import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import {
  securityAffectedPackages,
  securityAdvisories,
  securityCveEnrichments,
} from "@vibeguard/db";

import type { ContentDb } from "./constants";
import {
  extractCveAliases,
  formatCveEnrichment,
  formatSecurityAdvisory,
  normalizePackageKey,
} from "./formatters";
import { parseSecurityAdvisoryListParams } from "./utils";

export async function listSecurityAdvisories(
  db: ContentDb,
  searchParams: URLSearchParams,
) {
  const params = parseSecurityAdvisoryListParams(searchParams);

  const conditions = [];

  if (params.ecosystem || params.packageName) {
    const pkgParts = [];
    if (params.ecosystem) {
      pkgParts.push(eq(securityAffectedPackages.ecosystem, params.ecosystem));
    }
    if (params.packageName && params.ecosystem) {
      pkgParts.push(
        eq(
          securityAffectedPackages.packageKey,
          normalizePackageKey(params.ecosystem, params.packageName),
        ),
      );
    }
    const pkgCond = and(...pkgParts);
    conditions.push(
      pkgCond
        ? sql`exists (select 1 from ${securityAffectedPackages} where ${securityAffectedPackages.advisoryId} = ${securityAdvisories.id} and ${pkgCond})`
        : sql`exists (select 1 from ${securityAffectedPackages} where ${securityAffectedPackages.advisoryId} = ${securityAdvisories.id})`,
    );
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
        sql`exists (select 1 from jsonb_array_elements_text(${securityAdvisories.aliases}) elem where elem ilike ${pattern})`,
        sql`exists (select 1 from jsonb_array_elements_text(${securityAdvisories.relatedIds}) elem where elem ilike ${pattern})`,
        sql`exists (select 1 from jsonb_array_elements_text(${securityAdvisories.upstreamIds}) elem where elem ilike ${pattern})`,
      )!,
    );
  }

  if (params.kev === false) {
    conditions.push(
      sql`not exists (
        select 1 from ${securityCveEnrichments}
        where ${securityCveEnrichments.kevListed} = true
        and (
          ${securityCveEnrichments.cveId} in (select elem::text from jsonb_array_elements_text(${securityAdvisories.aliases}) elem)
          or ${securityCveEnrichments.cveId} in (select elem::text from jsonb_array_elements_text(${securityAdvisories.upstreamIds}) elem)
        )
      )`,
    );
  }

  if (params.kev === true || params.cvssMin !== null || params.epssMin !== null) {
    const enrichmentConditions = [];
    if (params.kev === true) {
      enrichmentConditions.push(eq(securityCveEnrichments.kevListed, true));
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

    const enrichCond = enrichmentConditions.length === 1
      ? enrichmentConditions[0]
      : and(...enrichmentConditions);

    conditions.push(
      sql`exists (
        select 1 from ${securityCveEnrichments}
        where ${enrichCond}
        and (
          ${securityCveEnrichments.cveId} in (select elem::text from jsonb_array_elements_text(${securityAdvisories.aliases}) elem)
          or ${securityCveEnrichments.cveId} in (select elem::text from jsonb_array_elements_text(${securityAdvisories.upstreamIds}) elem)
        )
      )`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

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
