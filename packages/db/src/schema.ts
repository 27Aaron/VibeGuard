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
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  SECURITY_RISK_TYPE_VALUES,
  SECURITY_SYNC_STATUS_VALUES,
} from "@vibeguard/shared";

export const articleStatusValues = ARTICLE_STATUS_VALUES;
export const articleEcosystemValues = ARTICLE_ECOSYSTEM_VALUES;
export const articleRiskCategoryValues = ARTICLE_RISK_CATEGORY_VALUES;
export const jobStatusValues = JOB_STATUS_VALUES;
export const jobTypeValues = JOB_TYPE_VALUES;
export const jobPipelineStageValues = JOB_PIPELINE_STAGE_VALUES;
export const securityPackageEcosystemValues = SECURITY_PACKAGE_ECOSYSTEM_VALUES;
export const securitySyncStatusValues = SECURITY_SYNC_STATUS_VALUES;
export const securityRiskTypeValues = SECURITY_RISK_TYPE_VALUES;

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

export const securityPackageEcosystemEnum = pgEnum(
  "security_package_ecosystem",
  securityPackageEcosystemValues,
);

export const securitySyncStatusEnum = pgEnum(
  "security_sync_status",
  securitySyncStatusValues,
);

export const securityRiskTypeEnum = pgEnum(
  "security_risk_type",
  securityRiskTypeValues,
);

export const articleEcosystemEnum = pgEnum(
  "article_ecosystem",
  articleEcosystemValues,
);

export const articleRiskCategoryEnum = pgEnum(
  "article_risk_category",
  articleRiskCategoryValues,
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
      .references(() => feeds.id, { onDelete: "cascade" }),
    sourceName: varchar("source_name", { length: 120 }).notNull(),
    url: text("url").notNull().unique(),
    canonicalUrl: text("canonical_url"),
    titleEn: text("title_en").notNull(),
    titleZh: text("title_zh"),
    summaryEn: text("summary_en"),
    summaryZh: text("summary_zh"),
    contentMdEn: text("content_md_en"),
    contentMdZh: text("content_md_zh"),
    ecosystem: articleEcosystemEnum("ecosystem").notNull().default("unknown"),
    riskCategory: articleRiskCategoryEnum("risk_category")
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
      .references(() => articles.id, { onDelete: "cascade" }),
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

export const securitySyncState = pgTable(
  "security_sync_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 32 }).notNull().default("osv"),
    ecosystem: securityPackageEcosystemEnum("ecosystem").notNull(),
    status: securitySyncStatusEnum("status").notNull().default("idle"),
    lastProcessedModifiedAt: timestamp("last_processed_modified_at", {
      withTimezone: true,
    }),
    lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastError: text("last_error"),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsImported: integer("records_imported").notNull().default(0),
    recordsFailed: integer("records_failed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("security_sync_state_source_ecosystem_unique").on(
      table.source,
      table.ecosystem,
    ),
    index("security_sync_state_status_idx").on(table.status),
  ],
);

// NOTE: securityAdvisories and securityAffectedPackages lack an automatic updatedAt
// trigger because Drizzle ORM's .$onUpdateFn() only fires on Drizzle-mediated updates.
// If true DB-level auto-update on ANY write is needed, add a PostgreSQL trigger via
// a dedicated migration (e.g. CREATE TRIGGER ... BEFORE UPDATE SET updated_at = NOW()).

export const securityAdvisories = pgTable(
  "security_advisories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 32 }).notNull().default("osv"),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    sourceUrl: text("source_url").notNull(),
    rawHash: varchar("raw_hash", { length: 128 }),
    riskType: securityRiskTypeEnum("risk_type").notNull().default("unknown"),
    summary: text("summary").notNull().default(""),
    details: text("details"),
    aliases: jsonb("aliases").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    severity: jsonb("severity")
      .$type<Array<{ type?: string; score?: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    modifiedAt: timestamp("modified_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    references: jsonb("references")
      .$type<Array<{ type?: string; url: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // updatedAt lacks a DB-level trigger — see note above securityAdvisories
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("security_advisories_source_external_unique").on(
      table.source,
      table.externalId,
    ),
    index("security_advisories_risk_type_idx").on(table.riskType),
    index("security_advisories_modified_at_idx").on(table.modifiedAt),
  ],
);

export const securityAffectedPackages = pgTable(
  "security_affected_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    advisoryId: uuid("advisory_id")
      .notNull()
      .references(() => securityAdvisories.id, { onDelete: "cascade" }),
    ecosystem: securityPackageEcosystemEnum("ecosystem").notNull(),
    packageName: text("package_name").notNull(),
    packageKey: text("package_key").notNull(),
    purl: text("purl"),
    affectedVersions: jsonb("affected_versions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ranges: jsonb("ranges")
      .$type<Array<{ type?: string; events?: Array<Record<string, string>> }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    fixedVersions: jsonb("fixed_versions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // updatedAt lacks a DB-level trigger — see note above securityAdvisories
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("security_affected_packages_advisory_package_unique").on(
      table.advisoryId,
      table.ecosystem,
      table.packageKey,
    ),
    index("security_affected_packages_lookup_idx").on(
      table.ecosystem,
      table.packageKey,
    ),
  ],
);

export const schema = {
  articleStatusEnum,
  articleEcosystemEnum,
  articleRiskCategoryEnum,
  jobStatusEnum,
  jobTypeEnum,
  jobPipelineStageEnum,
  securityPackageEcosystemEnum,
  securitySyncStatusEnum,
  securityRiskTypeEnum,
  feeds,
  articles,
  processingJobs,
  llmSettings,
  securitySyncState,
  securityAdvisories,
  securityAffectedPackages,
} as const;
