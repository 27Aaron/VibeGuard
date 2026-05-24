import { eq, inArray } from "drizzle-orm";

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
} from "./formatters";

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
