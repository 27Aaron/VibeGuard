import { fetchArticleHtml } from "@vibeguard/content/extract/article-html";
import {
  type ExtractedArticle,
} from "@vibeguard/content";
import { articles, llmSettings, schema } from "@vibeguard/db";
import {
  createOpenAIClient,
  decryptSecret,
  generateTags,
  summarizeText,
  translateText,
} from "@vibeguard/llm";
import {
  ArticleEcosystem,
  ArticleRiskCategory,
  ArticleStatus,
  JobPipelineStage,
} from "@vibeguard/shared";
import type { UsageResult } from "@vibeguard/llm";

type ArticleRecord = typeof articles.$inferSelect;
type LlmSettingsRecord = typeof llmSettings.$inferSelect;
type JobRecord = typeof schema.processingJobs.$inferSelect;

export class JobPausedSignal extends Error {
  constructor(message = "Job pause requested.") {
    super(message);
    this.name = "JobPausedSignal";
  }
}

export class JobCancelledSignal extends Error {
  constructor(message = "Job cancel requested.") {
    super(message);
    this.name = "JobCancelledSignal";
  }
}

type ProcessArticleFinalStatus =
  | typeof ArticleStatus.READY
  | typeof ArticleStatus.FILTERED;
type ArticlePatch = Partial<
  Pick<
    ArticleRecord,
    | "titleEn"
    | "titleZh"
    | "summaryEn"
    | "summaryZh"
    | "contentMdEn"
    | "contentMdZh"
    | "ecosystem"
    | "riskCategory"
    | "tags"
    | "contentHash"
    | "status"
    | "rawMeta"
  >
>;

export type ProcessArticleJobDependencies = {
  loadArticle: (articleId: string) => Promise<ArticleRecord | undefined>;
  loadActiveLlmSettings: () => Promise<LlmSettingsRecord | undefined>;
  markArticleStatus: (
    articleId: string,
    status: (typeof ArticleStatus)[keyof typeof ArticleStatus],
    error?: string,
  ) => Promise<void>;
  updateArticleContent: (
    articleId: string,
    content: {
      titleEn: string;
      titleZh: string;
      summaryEn: string;
      summaryZh: string;
      contentMdEn: string;
      contentMdZh: string;
      ecosystem: ArticleEcosystem;
      riskCategory: ArticleRiskCategory;
      tags: string[];
      contentHash: string;
      rawMeta: Record<string, unknown>;
    },
  ) => Promise<void>;
  updateArticlePatch?: (
    articleId: string,
    patch: ArticlePatch,
  ) => Promise<void>;
  fetchArticleHtml: typeof fetchArticleHtml;
  extractMarkdownFromHtml: (
    html: string,
    url: string,
  ) => Promise<ExtractedArticle>;
  createOpenAIClient: typeof createOpenAIClient;
  decryptSecret: typeof decryptSecret;
  translateText: typeof translateText;
  summarizeText: typeof summarizeText;
  generateTags?: typeof generateTags;
  markJobStage?: (
    stage: (typeof JobPipelineStage)[keyof typeof JobPipelineStage],
  ) => Promise<void>;
  checkJobControl?: () => Promise<void>;
  logLlmUsage?: (input: {
    articleId: string;
    jobId?: string;
    taskType: string;
    model: string;
    usage: UsageResult | null;
    responseTimeMs: number;
  }) => Promise<void>;
};

// Re-export types used by helpers and the main module.
export type {
  ArticleRecord,
  ArticlePatch,
  LlmSettingsRecord,
  JobRecord,
  ProcessArticleFinalStatus,
};
