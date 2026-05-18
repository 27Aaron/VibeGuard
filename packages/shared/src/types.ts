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
