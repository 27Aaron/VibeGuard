import { desc, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  schema,
  securityAffectedPackages,
  securitySyncState,
} from "@vibeguard/db";
import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared";

type ContentDb = NodePgDatabase<typeof schema>;

export type SecurityOverviewTotals = Record<SecurityPackageEcosystem, number>;

export async function getSecurityOverviewTotals(
  db: ContentDb,
): Promise<SecurityOverviewTotals> {
  const rows = await db
    .select({
      ecosystem: securityAffectedPackages.ecosystem,
      count: sql<number>`count(*)::int`,
    })
    .from(securityAffectedPackages)
    .groupBy(securityAffectedPackages.ecosystem);

  const totals = Object.fromEntries(
    SECURITY_PACKAGE_ECOSYSTEM_VALUES.map((ecosystem) => [ecosystem, 0]),
  ) as SecurityOverviewTotals;

  for (const row of rows) {
    totals[row.ecosystem] = Number(row.count);
  }

  return totals;
}

export async function getLastSyncTime(db: ContentDb): Promise<Date | null> {
  const row = await db.query.securitySyncState.findFirst({
    columns: { lastSuccessAt: true },
    orderBy: [desc(securitySyncState.lastSuccessAt)],
  });
  return row?.lastSuccessAt ?? null;
}
