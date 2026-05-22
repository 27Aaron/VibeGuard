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
] as const);

export const ARTICLE_STATUS_VALUES = articleStatuses.values;
export const ArticleStatus = articleStatuses.map;
export type ArticleStatus = (typeof ARTICLE_STATUS_VALUES)[number];

const jobStatuses = defineStatuses([
  "queued",
  "running",
  "succeeded",
  "failed",
] as const);

export const JOB_STATUS_VALUES = jobStatuses.values;
export const JobStatus = jobStatuses.map;
export type JobStatus = (typeof JOB_STATUS_VALUES)[number];

const jobTypes = defineStatuses([
  "extract",
  "translate",
  "summarize",
] as const);

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
] as const);

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
] as const);

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
] as const);

export const ARTICLE_RISK_CATEGORY_VALUES = articleRiskCategories.values;
export const ArticleRiskCategory = articleRiskCategories.map;
export type ArticleRiskCategory =
  (typeof ARTICLE_RISK_CATEGORY_VALUES)[number];

const securityPackageEcosystems = defineStatuses([
  "npm",
  "pypi",
  "go",
  "crates-io",
] as const);

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
] as const);

export const SECURITY_SYNC_STATUS_VALUES = securitySyncStatuses.values;
export const SecuritySyncStatus = securitySyncStatuses.map;
export type SecuritySyncStatus =
  (typeof SECURITY_SYNC_STATUS_VALUES)[number];

const securityRiskTypes = defineStatuses([
  "unknown",
  "vulnerability",
  "malicious-package",
] as const);

export const SECURITY_RISK_TYPE_VALUES = securityRiskTypes.values;
export const SecurityRiskType = securityRiskTypes.map;
export type SecurityRiskType = (typeof SECURITY_RISK_TYPE_VALUES)[number];

const securityPackageMatchConfidences = defineStatuses([
  "high",
  "medium",
  "low",
  "none",
] as const);

export const SECURITY_PACKAGE_MATCH_CONFIDENCE_VALUES =
  securityPackageMatchConfidences.values;
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
] as const);

export const SECURITY_PACKAGE_MATCH_REASON_VALUES =
  securityPackageMatchReasons.values;
export const SecurityPackageMatchReason = securityPackageMatchReasons.map;
export type SecurityPackageMatchReason =
  (typeof SECURITY_PACKAGE_MATCH_REASON_VALUES)[number];
