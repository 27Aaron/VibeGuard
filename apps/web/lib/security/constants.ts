import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { checkPackagesAgainstLocalDb } from "@vibeguard/content/osv/query";
import { schema } from "@vibeguard/db";
import type { SecurityPackageEcosystem, SecurityRiskType } from "@vibeguard/shared";

export type ContentDb = NodePgDatabase<typeof schema>;
export type SecurityCheckPayload = Awaited<
  ReturnType<typeof checkPackagesAgainstLocalDb>
>;
export type SecurityFinding = SecurityCheckPayload["findings"][number];

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
