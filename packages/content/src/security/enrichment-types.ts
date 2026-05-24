import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { schema, securityCveEnrichments } from "@vibeguard/db";

import { normalizeInt } from "../shared/normalize";
import type { SecuritySyncStateUpdateInput } from "../osv/store";

type ContentDb = NodePgDatabase<typeof schema>;

export const CISA_KEV_JSON_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
export const FIRST_EPSS_CURRENT_CSV_GZ_URL =
  "https://epss.cyentia.com/epss_scores-current.csv.gz";
export const NVD_FEED_BASE_URL = "https://nvd.nist.gov/feeds/json/cve/2.0";
export const NVD_MODIFIED_FEED_URL = `${NVD_FEED_BASE_URL}/nvdcve-2.0-modified.json.gz`;
export const NVD_FULL_FEED_START_YEAR = 2002;

const MEBIBYTE = 1024 * 1024;
export const DEFAULT_CISA_KEV_JSON_BYTES = 8 * MEBIBYTE;
export const DEFAULT_EPSS_CSV_GZ_BYTES = 16 * MEBIBYTE;
export const DEFAULT_EPSS_CSV_TEXT_BYTES = 64 * MEBIBYTE;
export const DEFAULT_NVD_FEED_GZ_BYTES = 64 * MEBIBYTE;
export const DEFAULT_NVD_FEED_JSON_BYTES = 512 * MEBIBYTE;

export const MAX_CISA_KEV_JSON_BYTES = normalizeInt(
  process.env.VIBEGUARD_CISA_KEV_JSON_BYTES,
  DEFAULT_CISA_KEV_JSON_BYTES,
);
export const MAX_EPSS_CSV_GZ_BYTES = normalizeInt(
  process.env.VIBEGUARD_EPSS_CSV_GZ_BYTES,
  DEFAULT_EPSS_CSV_GZ_BYTES,
);
export const MAX_EPSS_CSV_TEXT_BYTES = normalizeInt(
  process.env.VIBEGUARD_EPSS_CSV_TEXT_BYTES,
  DEFAULT_EPSS_CSV_TEXT_BYTES,
);
export const MAX_NVD_FEED_GZ_BYTES = normalizeInt(
  process.env.VIBEGUARD_NVD_FEED_GZ_BYTES,
  DEFAULT_NVD_FEED_GZ_BYTES,
);
export const MAX_NVD_FEED_JSON_BYTES = normalizeInt(
  process.env.VIBEGUARD_NVD_FEED_JSON_BYTES,
  DEFAULT_NVD_FEED_JSON_BYTES,
);

export type SecurityCveEnrichmentPatch = {
  cveId: string;
  title?: string | null;
  description?: string | null;
  cvssMetrics?: Array<{
    source?: string;
    version?: string;
    vector?: string;
    baseScore?: string;
    baseSeverity?: string;
    exploitabilityScore?: string;
    impactScore?: string;
  }>;
  bestCvssScore?: string | null;
  bestCvssSeverity?: string | null;
  cweIds?: string[];
  epss?: string | null;
  epssPercentile?: string | null;
  epssScoreDate?: Date | null;
  epssModelVersion?: string | null;
  kevListed?: boolean;
  kevDateAdded?: Date | null;
  kevDueDate?: Date | null;
  kevKnownRansomwareCampaignUse?: string | null;
  kevRequiredAction?: string | null;
  kevVendorProject?: string | null;
  kevProduct?: string | null;
  kevNotes?: string | null;
  nvdPublishedAt?: Date | null;
  nvdModifiedAt?: Date | null;
};

export type UpsertSecurityCveEnrichmentsOptions = {
  table?: typeof securityCveEnrichments;
  batchSize?: number;
};

export type SecurityEnrichmentSyncSummary = {
  source: string;
  scope: string;
  recordsSeen: number;
  recordsImported: number;
  recordsFailed: number;
};

export type SecurityEnrichmentSyncMode = "bootstrap" | "incremental";

export type SyncNvdYearFeedInput = {
  db: ContentDb;
  year: number;
};

export type SyncNvdFullHistoryInput = {
  db: ContentDb;
  years?: number[];
  now?: () => Date;
  syncNvdYearFeed?: (
    input: SyncNvdYearFeedInput,
  ) => Promise<SecurityEnrichmentSyncSummary>;
  upsertSecuritySyncState?: (
    db: ContentDb,
    scope: string,
    input: SecuritySyncStateUpdateInput,
  ) => Promise<void>;
};

export type SyncAllSecurityEnrichmentSourcesOptions = {
  mode?: SecurityEnrichmentSyncMode;
  nvdYears?: number[];
  syncCisaKevCatalog?: (input: { db: ContentDb }) => Promise<SecurityEnrichmentSyncSummary>;
  syncFirstEpssScores?: (input: { db: ContentDb }) => Promise<SecurityEnrichmentSyncSummary>;
  syncNvdModifiedFeed?: (input: { db: ContentDb }) => Promise<SecurityEnrichmentSyncSummary>;
  syncNvdFullHistory?: (
    input: SyncNvdFullHistoryInput,
  ) => Promise<SecurityEnrichmentSyncSummary>;
};

export type { ContentDb };

export type { SecuritySyncStateUpdateInput };
