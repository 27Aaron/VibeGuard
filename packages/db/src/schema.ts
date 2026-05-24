import { desc, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
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

// 性能优化：对于高写入频率的表（如 articles、processing_jobs），建议将
// UUID v4（defaultRandom）替换为 UUID v7（时间有序）。UUID v7 的时间递增特性
// 可以显著减少 B-tree 索引的页分裂与碎片化，从而提升 INSERT 性能。但该改动
// 需要编写数据库迁移脚本并在应用层实现 UUID v7 生成逻辑，因此暂时搁置。
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
    // 待办：布尔类型单列索引的选择性极低（约 50% 的行为 true），导致索引效率不高。
    // 建议改为部分索引（partial index），即 `WHERE enabled = true`，仅对活跃的
    // feed 建立索引，这样索引体积会小得多，查询性能也更优。Drizzle ORM 的索引
    // 构建器支持通过 `.where()` 方法创建部分索引，但需要编写数据库迁移脚本来落地。
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
      .where(sql`${table.status} <> 'succeeded' and ${table.status} <> 'failed'`),
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
    relevancePrompt: text("relevance_prompt").notNull().default("Determine whether the article is relevant to software supply-chain security. Output ONLY JSON: {\"relevant\": true/false, \"reason\": \"one-sentence explanation\"}"),
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

export const llmUsageLogs = pgTable(
  "llm_usage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => processingJobs.id, {
      onDelete: "set null",
    }),
    taskType: varchar("task_type", { length: 40 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    cachedTokens: integer("cached_tokens"),
    finishReason: varchar("finish_reason", { length: 20 }),
    responseTimeMs: integer("response_time_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("llm_usage_logs_created_at_idx").on(table.createdAt),
    index("llm_usage_logs_article_id_idx").on(table.articleId),
    index("llm_usage_logs_task_type_idx").on(table.taskType),
  ],
);

export const securitySyncState = pgTable(
  "security_sync_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 32 }).notNull().default("osv"),
    scope: varchar("scope", { length: 64 }).notNull().default("global"),
    status: securitySyncStatusEnum("status").notNull().default("idle"),
    lastProcessedModifiedAt: timestamp("last_processed_modified_at", {
      withTimezone: true,
    }),
    cursorJson: jsonb("cursor_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
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
    uniqueIndex("security_sync_state_source_scope_unique").on(
      table.source,
      table.scope,
    ),
    index("security_sync_state_status_idx").on(table.status),
  ],
);

// 注意：securityAdvisories 和 securityAffectedPackages 表的 updatedAt 字段没有数据库
// 级别的自动更新触发器。原因是 Drizzle ORM 的 .$onUpdateFn() 仅在使用 Drizzle API
// 执行更新操作时才会触发，无法覆盖原始 SQL 或其他 ORM 发起的写入。如果需要在任何
// 写入方式下都保证 updated_at 自动刷新，应通过独立的数据库迁移脚本添加 PostgreSQL
// 触发器，例如：CREATE TRIGGER ... BEFORE UPDATE ON ... SET updated_at = NOW()。

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
    relatedIds: jsonb("related_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    upstreamIds: jsonb("upstream_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
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
    maliciousOrigins: jsonb("malicious_origins")
      .$type<
        Array<{
          id?: string
          source?: string
          importTime?: string
          modifiedTime?: string
          versions: string[]
          sha256?: string
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // updatedAt 缺少数据库级别的自动更新触发器——详见上方 securityAdvisories 表前的注释
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
    // updatedAt 缺少数据库级别的自动更新触发器——详见上方 securityAdvisories 表前的注释
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

export const securityCveEnrichments = pgTable(
  "security_cve_enrichments",
  {
    cveId: varchar("cve_id", { length: 32 }).primaryKey(),
    title: text("title"),
    description: text("description"),
    cvssMetrics: jsonb("cvss_metrics")
      .$type<
        Array<{
          source?: string;
          version?: string;
          vector?: string;
          baseScore?: string;
          baseSeverity?: string;
          exploitabilityScore?: string;
          impactScore?: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    bestCvssScore: numeric("best_cvss_score", { precision: 3, scale: 1 }),
    bestCvssSeverity: varchar("best_cvss_severity", { length: 16 }),
    cweIds: jsonb("cwe_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    epss: numeric("epss", { precision: 6, scale: 5 }),
    epssPercentile: numeric("epss_percentile", { precision: 6, scale: 5 }),
    epssScoreDate: timestamp("epss_score_date", { withTimezone: true }),
    epssModelVersion: varchar("epss_model_version", { length: 40 }),
    kevListed: boolean("kev_listed").notNull().default(false),
    kevDateAdded: timestamp("kev_date_added", { withTimezone: true }),
    kevDueDate: timestamp("kev_due_date", { withTimezone: true }),
    kevKnownRansomwareCampaignUse: varchar(
      "kev_known_ransomware_campaign_use",
      { length: 32 },
    ),
    kevRequiredAction: text("kev_required_action"),
    kevVendorProject: text("kev_vendor_project"),
    kevProduct: text("kev_product"),
    kevNotes: text("kev_notes"),
    nvdPublishedAt: timestamp("nvd_published_at", { withTimezone: true }),
    nvdModifiedAt: timestamp("nvd_modified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("security_cve_enrichments_kev_listed_idx").on(table.kevListed),
    index("security_cve_enrichments_best_cvss_score_idx").on(
      table.bestCvssScore,
    ),
    index("security_cve_enrichments_epss_percentile_idx").on(
      table.epssPercentile,
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
  llmUsageLogs,
  securitySyncState,
  securityAdvisories,
  securityAffectedPackages,
  securityCveEnrichments,
} as const;
