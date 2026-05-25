// Barrel re-export — all public API lives in the split modules below.

// Types and constants
export {
  CISA_KEV_JSON_URL,
  FIRST_EPSS_CURRENT_CSV_GZ_URL,
  NVD_FEED_BASE_URL,
  NVD_MODIFIED_FEED_URL,
  NVD_FULL_FEED_START_YEAR,
  DEFAULT_CISA_KEV_JSON_BYTES,
  DEFAULT_EPSS_CSV_GZ_BYTES,
  DEFAULT_EPSS_CSV_TEXT_BYTES,
  DEFAULT_NVD_FEED_GZ_BYTES,
  DEFAULT_NVD_FEED_JSON_BYTES,
} from "./enrichment-types";

export type {
  SecurityCveEnrichmentPatch,
  SecurityEnrichmentSyncSummary,
  SecurityEnrichmentSyncMode,
} from "./enrichment-types";

// Parsers
export {
  buildNvdModifiedFeedUrl,
  buildNvdYearFeedUrl,
  parseKevCatalog,
  parseEpssCsv,
  parseNvdVulnerabilityEntry,
  parseNvdModifiedFeed,
} from "./enrichment-parsers";

// Database
export { upsertSecurityCveEnrichments } from "./enrichment-db";

// Fetch utilities
export {
  fetchSecurityFeedBytes,
  fetchSecurityFeedText,
  gunzipSecurityFeedText,
} from "./enrichment-fetch";

// Sync
export {
  syncCisaKevCatalog,
  syncFirstEpssScores,
  syncNvdModifiedFeed,
  syncNvdYearFeed,
  streamNvdGzipFeedPatches,
  syncNvdFullHistory,
  syncAllSecurityEnrichmentSources,
  buildSecurityEnrichmentSyncStateUpdate,
} from "./enrichment-sync";
