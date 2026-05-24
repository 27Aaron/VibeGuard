export type FeedRow = {
  id: string;
  name: string;
  siteUrl: string;
  feedUrl: string;
  feedType: string;
  pollIntervalMinutes: number;
  enabled: boolean;
  cadence: string;
  status: "enabled" | "paused";
  lastSyncedAt: string;
};

export type ArticleRow = {
  id: string;
  title: string;
  titleEn: string;
  titleZh: string | null;
  summary: string | null;
  source: string;
  status: "ready" | "processing" | "pending" | "failed" | "filtered";
  publishedAt: string;
  updatedAt: string;
};

export type JobPreviewRow = {
  id: string;
  articleTitle: string;
  jobType: "extract" | "translate" | "summarize";
  status:
    | "queued"
    | "running"
    | "paused"
    | "pause_requested"
    | "cancel_requested"
    | "succeeded"
    | "failed";
  runAt: string;
};

export type JobRow = {
  id: string;
  articleId: string;
  articleTitle: string;
  sourceName: string;
  jobType: "extract" | "translate" | "summarize";
  status:
    | "queued"
    | "running"
    | "paused"
    | "pause_requested"
    | "cancel_requested"
    | "succeeded"
    | "failed"
    | "filtered";
  pipelineStage:
    | "waiting"
    | "fetch_source"
    | "extract_content"
    | "classify_relevance"
    | "translate_title"
    | "translate_content"
    | "summarize_en"
    | "summarize_zh"
    | "generate_tags"
    | "completed";
  attempt: number;
  maxAttempts: number;
  runAt: string;
  startedAt: string;
  finishedAt: string;
  updatedAt: string;
  lastError: string | null;
};

export type JobStatusFilter =
  | "all"
  | "running"
  | "queued"
  | "paused"
  | "failed"
  | "filtered";
export type JobStageFilter = "all" | JobRow["pipelineStage"];

export type JobStatusCount = {
  status: JobStatusFilter;
  label: string;
  count: number;
};

export type ProviderSettings = {
  id: string;
  providerName: string;
  settingsName: string;
  baseUrl: string;
  hasStoredApiKey: boolean;
  model: string;
  isActive: boolean;
};

export type LlmSettingsRow = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  hasStoredApiKey: boolean;
  updatedAt: string;
};

export type PipelineSettings = {
  relevancePrompt: string;
  translationTitlePrompt: string;
  translationContentPrompt: string;
  summaryPromptEn: string;
  summaryPromptZh: string;
  tagPrompt: string;
};
