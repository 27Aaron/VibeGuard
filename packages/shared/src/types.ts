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
 * 运行时映射表：`ArticleStatus.READY` → `"ready"`（大写键映射到小写值）。
 *
 * 说明：`ArticleStatus` 既是**常量值**（映射对象），又是**类型**（联合类型
 * `"pending" | "processing" | ...`）。这是有意为之的设计——类型代表合法的状态
 * 字符串，常量则提供安全的运行时查找，避免消费者在代码中硬编码原始字符串。
 * TypeScript 通过声明合并（declaration merging）将两者统一，因此导入
 * `ArticleStatus` 即可同时获得类型和运行时对象。
 */
export const ArticleStatus = articleStatuses.map;
export type ArticleStatus = (typeof ARTICLE_STATUS_VALUES)[number];

const jobStatuses = defineStatuses([
  "queued",
  "running",
  "paused",
  "pause_requested",
  "cancel_requested",
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
  "undetermined",
]);

export const SECURITY_PACKAGE_MATCH_CONFIDENCE_VALUES =
  securityPackageMatchConfidences.values;
/**
 * 包与安全公告（advisory）匹配结果的置信度等级。
 *
 * - `"high"` / `"medium"` / `"low"` — 找到了匹配结果，置信度分别为高、中、低。
 * - `"undetermined"` — **未得出确定性结论**。表示安全公告的数据不足以判断该包
 *   是否受影响或不受影响，但这并不意味着该包一定是安全的。
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
