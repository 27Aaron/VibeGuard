function defineStatuses<const TValues extends readonly string[]>(
  values: TValues,
) {
  return {
    values,
    map: Object.freeze(
      Object.fromEntries(
        values.map((value) => [value.toUpperCase(), value]),
      ) as {
        readonly [TValue in TValues[number] as Uppercase<TValue>]: TValue;
      },
    ),
  };
}

const articleStatuses = defineStatuses([
  "pending",
  "processing",
  "ready",
  "failed",
  "filtered",
]);

export const ARTICLE_STATUS_VALUES = articleStatuses.values;
/**
 * Runtime map: `ArticleStatus.READY` → `"ready"` (uppercase key → lowercase value).
 *
 * Note: `ArticleStatus` is both a **const value** (the map object) and a **type**
 * (the union `"pending" | "processing" | ...`).  This is intentional — the type
 * represents the valid status strings, while the const provides a safe runtime
 * lookup so consumers never hard-code raw strings.  TypeScript merges the two
 * declarations via declaration merging, so importing `ArticleStatus` gives
 * access to both the type and the runtime object.
 */
export const ArticleStatus = articleStatuses.map;
export type ArticleStatus = (typeof ARTICLE_STATUS_VALUES)[number];

const jobStatuses = defineStatuses([
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const JOB_STATUS_VALUES = jobStatuses.values;
export const JobStatus = jobStatuses.map;
export type JobStatus = (typeof JOB_STATUS_VALUES)[number];

const jobTypes = defineStatuses([
  "extract",
  "translate",
  "summarize",
]);

export const JOB_TYPE_VALUES = jobTypes.values;
export const JobType = jobTypes.map;
export type JobType = (typeof JOB_TYPE_VALUES)[number];

const jobPipelineStages = defineStatuses([
  "waiting",
  "fetch_source",
  "extract_content",
  "classify_relevance",
  "translate_title",
  "translate_content",
  "summarize_en",
  "summarize_zh",
  "generate_tags",
  "completed",
]);

export const JOB_PIPELINE_STAGE_VALUES = jobPipelineStages.values;
export const JobPipelineStage = jobPipelineStages.map;
export type JobPipelineStage = (typeof JOB_PIPELINE_STAGE_VALUES)[number];

const articleEcosystems = defineStatuses([
  "unknown",
  "npm",
  "pypi",
  "maven",
  "go",
  "crates-io",
  "github-actions",
  "docker",
  "multi",
]);

export const ARTICLE_ECOSYSTEM_VALUES = articleEcosystems.values;
export const ArticleEcosystem = articleEcosystems.map;
export type ArticleEcosystem = (typeof ARTICLE_ECOSYSTEM_VALUES)[number];

const articleRiskCategories = defineStatuses([
  "unknown",
  "vulnerability",
  "exploit-activity",
  "malicious-package",
  "supply-chain-attack",
  "dependency-risk",
]);

export const ARTICLE_RISK_CATEGORY_VALUES = articleRiskCategories.values;
export const ArticleRiskCategory = articleRiskCategories.map;
export type ArticleRiskCategory =
  (typeof ARTICLE_RISK_CATEGORY_VALUES)[number];

const securityPackageEcosystems = defineStatuses([
  "npm",
  "pypi",
  "go",
  "crates-io",
]);

export const SECURITY_PACKAGE_ECOSYSTEM_VALUES =
  securityPackageEcosystems.values;
export const SecurityPackageEcosystem = securityPackageEcosystems.map;
export type SecurityPackageEcosystem =
  (typeof SECURITY_PACKAGE_ECOSYSTEM_VALUES)[number];

const securitySyncStatuses = defineStatuses([
  "idle",
  "running",
  "success",
  "failed",
]);

export const SECURITY_SYNC_STATUS_VALUES = securitySyncStatuses.values;
export const SecuritySyncStatus = securitySyncStatuses.map;
export type SecuritySyncStatus =
  (typeof SECURITY_SYNC_STATUS_VALUES)[number];

const securityRiskTypes = defineStatuses([
  "unknown",
  "vulnerability",
  "malicious-package",
]);

export const SECURITY_RISK_TYPE_VALUES = securityRiskTypes.values;
export const SecurityRiskType = securityRiskTypes.map;
export type SecurityRiskType = (typeof SECURITY_RISK_TYPE_VALUES)[number];

const securityPackageMatchConfidences = defineStatuses([
  "high",
  "medium",
  "low",
  "none",
]);

export const SECURITY_PACKAGE_MATCH_CONFIDENCE_VALUES =
  securityPackageMatchConfidences.values;
/**
 * Confidence levels for package-to-advisory matching.
 *
 * - `"high"` / `"medium"` / `"low"` — a match was found with the given confidence.
 * - `"none"` — **no match was found at all**.  This means the package was not
 *   determined to be affected or unaffected; the advisory data was insufficient
 *   to make any determination.  It does *not* mean the package is explicitly safe.
 */
export const SecurityPackageMatchConfidence =
  securityPackageMatchConfidences.map;
export type SecurityPackageMatchConfidence =
  (typeof SECURITY_PACKAGE_MATCH_CONFIDENCE_VALUES)[number];

const securityPackageMatchReasons = defineStatuses([
  "explicit_affected_version",
  "version_in_ecosystem_range",
  "version_outside_ecosystem_range",
  "range_present_but_inconclusive",
  "package_match_without_version",
]);

export const SECURITY_PACKAGE_MATCH_REASON_VALUES =
  securityPackageMatchReasons.values;
export const SecurityPackageMatchReason = securityPackageMatchReasons.map;
export type SecurityPackageMatchReason =
  (typeof SECURITY_PACKAGE_MATCH_REASON_VALUES)[number];
