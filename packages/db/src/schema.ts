import { desc, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  ARTICLE_ECOSYSTEM_VALUES,
  ARTICLE_RISK_CATEGORY_VALUES,
  ARTICLE_STATUS_VALUES,
  JOB_PIPELINE_STAGE_VALUES,
  JOB_STATUS_VALUES,
  JOB_TYPE_VALUES,
} from "@vibeguard/shared";

export const articleStatusValues = ARTICLE_STATUS_VALUES;
export const articleEcosystemValues = ARTICLE_ECOSYSTEM_VALUES;
export const articleRiskCategoryValues = ARTICLE_RISK_CATEGORY_VALUES;
export const jobStatusValues = JOB_STATUS_VALUES;
export const jobTypeValues = JOB_TYPE_VALUES;
export const jobPipelineStageValues = JOB_PIPELINE_STAGE_VALUES;

export const articleStatusEnum = pgEnum(
  "article_status",
  articleStatusValues,
);

export const jobStatusEnum = pgEnum("job_status", jobStatusValues);

export const jobTypeEnum = pgEnum("job_type", jobTypeValues);

export const jobPipelineStageEnum = pgEnum(
  "job_pipeline_stage",
  jobPipelineStageValues,
);

export const feeds = pgTable(
  "feeds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    siteUrl: text("site_url").notNull(),
    feedUrl: text("feed_url").notNull().unique(),
    feedType: varchar("feed_type", { length: 16 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    pollIntervalMinutes: integer("poll_interval_minutes").notNull().default(30),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("feeds_enabled_idx").on(table.enabled),
    index("feeds_last_polled_at_idx").on(table.lastPolledAt),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedId: uuid("feed_id")
      .notNull()
      .references(() => feeds.id),
    sourceName: varchar("source_name", { length: 120 }).notNull(),
    url: text("url").notNull().unique(),
    canonicalUrl: text("canonical_url"),
    titleEn: text("title_en").notNull(),
    titleZh: text("title_zh"),
    summaryEn: text("summary_en"),
    summaryZh: text("summary_zh"),
    contentMdEn: text("content_md_en"),
    contentMdZh: text("content_md_zh"),
    ecosystem: varchar("ecosystem", { length: 32 }).notNull().default("unknown"),
    riskCategory: varchar("risk_category", { length: 32 })
      .notNull()
      .default("unknown"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    publishedAtIsFallback: boolean("published_at_is_fallback")
      .notNull()
      .default(false),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    status: articleStatusEnum("status").notNull().default("pending"),
    contentHash: varchar("content_hash", { length: 128 }),
    rawMeta: jsonb("raw_meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("articles_canonical_url_unique")
      .on(table.canonicalUrl)
      .where(sql`${table.canonicalUrl} is not null`),
    index("articles_status_idx").on(table.status),
    index("articles_ecosystem_idx").on(table.ecosystem),
    index("articles_risk_category_idx").on(table.riskCategory),
    index("articles_published_at_idx").on(desc(table.publishedAt)),
    index("articles_feed_id_idx").on(table.feedId),
  ],
);

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id),
    jobType: jobTypeEnum("job_type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    pipelineStage: jobPipelineStageEnum("pipeline_stage")
      .notNull()
      .default("waiting"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    runAfter: timestamp("run_after", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("processing_jobs_status_run_after_idx").on(
      table.status,
      table.runAfter,
    ),
    index("processing_jobs_pipeline_stage_idx").on(table.pipelineStage),
    uniqueIndex("processing_jobs_article_job_type_unique").on(
      table.articleId,
      table.jobType,
    ),
    uniqueIndex("processing_jobs_active_unique")
      .on(table.articleId, table.jobType)
      .where(sql`${table.status} in ('queued', 'running')`),
  ],
);

export const llmSettings = pgTable(
  "llm_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    baseUrl: text("base_url").notNull(),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    translateTitlePrompt: text("translate_title_prompt").notNull(),
    translateContentPrompt: text("translate_content_prompt").notNull(),
    summaryPromptEn: text("summary_prompt_en").notNull(),
    summaryPromptZh: text("summary_prompt_zh").notNull(),
    tagPrompt: text("tag_prompt").notNull().default("Extract short supply-chain security tags as strict JSON."),
    relevancePrompt: text("relevance_prompt").notNull().default("判断以下文章是否与软件供应链安全、开源安全、依赖安全、恶意包、漏洞利用等相关。只输出 JSON：{\"relevant\": true/false, \"reason\": \"简短理由\"}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("llm_settings_active_unique")
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
  ],
);

export const schema = {
  articleStatusEnum,
  jobStatusEnum,
  jobTypeEnum,
  jobPipelineStageEnum,
  feeds,
  articles,
  processingJobs,
  llmSettings,
} as const;
