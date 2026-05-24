CREATE TYPE "public"."article_ecosystem" AS ENUM('unknown', 'npm', 'pypi', 'maven', 'go', 'crates-io', 'github-actions', 'docker', 'multi');--> statement-breakpoint
CREATE TYPE "public"."article_risk_category" AS ENUM('unknown', 'vulnerability', 'exploit-activity', 'malicious-package', 'supply-chain-attack', 'dependency-risk');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'filtered');--> statement-breakpoint
CREATE TYPE "public"."job_pipeline_stage" AS ENUM('waiting', 'fetch_source', 'extract_content', 'classify_relevance', 'translate_title', 'translate_content', 'summarize_en', 'summarize_zh', 'generate_tags', 'completed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'paused', 'pause_requested', 'cancel_requested', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('extract', 'translate', 'summarize');--> statement-breakpoint
CREATE TYPE "public"."security_package_ecosystem" AS ENUM('npm', 'pypi', 'go', 'crates-io');--> statement-breakpoint
CREATE TYPE "public"."security_risk_type" AS ENUM('unknown', 'vulnerability', 'malicious-package');--> statement-breakpoint
CREATE TYPE "public"."security_sync_status" AS ENUM('idle', 'running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_id" uuid NOT NULL,
	"source_name" varchar(120) NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text,
	"title_en" text NOT NULL,
	"title_zh" text,
	"summary_en" text,
	"summary_zh" text,
	"content_md_en" text,
	"content_md_zh" text,
	"ecosystem" "article_ecosystem" DEFAULT 'unknown' NOT NULL,
	"risk_category" "article_risk_category" DEFAULT 'unknown' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_at_is_fallback" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"status" "article_status" DEFAULT 'pending' NOT NULL,
	"content_hash" varchar(128),
	"raw_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"site_url" text NOT NULL,
	"feed_url" text NOT NULL,
	"feed_type" varchar(16) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"poll_interval_minutes" integer DEFAULT 30 NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feeds_feed_url_unique" UNIQUE("feed_url")
);
--> statement-breakpoint
CREATE TABLE "llm_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"base_url" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"model" varchar(120) NOT NULL,
	"translate_title_prompt" text NOT NULL,
	"translate_content_prompt" text NOT NULL,
	"summary_prompt_en" text NOT NULL,
	"summary_prompt_zh" text NOT NULL,
	"tag_prompt" text DEFAULT 'Extract short supply-chain security tags as strict JSON.' NOT NULL,
	"relevance_prompt" text DEFAULT 'Determine whether the article is relevant to software supply-chain security. Output ONLY JSON: {"relevant": true/false, "reason": "one-sentence explanation"}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"job_id" uuid,
	"task_type" varchar(40) NOT NULL,
	"model" varchar(120) NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"cached_tokens" integer,
	"finish_reason" varchar(20),
	"response_time_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"job_type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"pipeline_stage" "job_pipeline_stage" DEFAULT 'waiting' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_advisories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(32) DEFAULT 'osv' NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"source_url" text NOT NULL,
	"raw_hash" varchar(128),
	"risk_type" "security_risk_type" DEFAULT 'unknown' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"details" text,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"upstream_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"severity" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"modified_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"malicious_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_affected_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisory_id" uuid NOT NULL,
	"ecosystem" "security_package_ecosystem" NOT NULL,
	"package_name" text NOT NULL,
	"package_key" text NOT NULL,
	"purl" text,
	"affected_versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fixed_versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_cve_enrichments" (
	"cve_id" varchar(32) PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"cvss_metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"best_cvss_score" numeric(3, 1),
	"best_cvss_severity" varchar(16),
	"cwe_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"epss" numeric(6, 5),
	"epss_percentile" numeric(6, 5),
	"epss_score_date" timestamp with time zone,
	"epss_model_version" varchar(40),
	"kev_listed" boolean DEFAULT false NOT NULL,
	"kev_date_added" timestamp with time zone,
	"kev_due_date" timestamp with time zone,
	"kev_known_ransomware_campaign_use" varchar(32),
	"kev_required_action" text,
	"kev_vendor_project" text,
	"kev_product" text,
	"kev_notes" text,
	"nvd_published_at" timestamp with time zone,
	"nvd_modified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(32) DEFAULT 'osv' NOT NULL,
	"scope" varchar(64) DEFAULT 'global' NOT NULL,
	"status" "security_sync_status" DEFAULT 'idle' NOT NULL,
	"last_processed_modified_at" timestamp with time zone,
	"cursor_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"records_seen" integer DEFAULT 0 NOT NULL,
	"records_imported" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_job_id_processing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_affected_packages" ADD CONSTRAINT "security_affected_packages_advisory_id_security_advisories_id_fk" FOREIGN KEY ("advisory_id") REFERENCES "public"."security_advisories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_canonical_url_unique" ON "articles" USING btree ("canonical_url") WHERE "articles"."canonical_url" is not null;--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_ecosystem_idx" ON "articles" USING btree ("ecosystem");--> statement-breakpoint
CREATE INDEX "articles_risk_category_idx" ON "articles" USING btree ("risk_category");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at" desc);--> statement-breakpoint
CREATE INDEX "articles_feed_id_idx" ON "articles" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feeds_enabled_idx" ON "feeds" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "feeds_last_polled_at_idx" ON "feeds" USING btree ("last_polled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "llm_settings_active_unique" ON "llm_settings" USING btree ("is_active") WHERE "llm_settings"."is_active" = true;--> statement-breakpoint
CREATE INDEX "llm_usage_logs_created_at_idx" ON "llm_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "llm_usage_logs_article_id_idx" ON "llm_usage_logs" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "llm_usage_logs_task_type_idx" ON "llm_usage_logs" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "processing_jobs_status_run_after_idx" ON "processing_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "processing_jobs_pipeline_stage_idx" ON "processing_jobs" USING btree ("pipeline_stage");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_jobs_active_unique" ON "processing_jobs" USING btree ("article_id","job_type") WHERE "processing_jobs"."status" <> 'succeeded' and "processing_jobs"."status" <> 'failed';--> statement-breakpoint
CREATE UNIQUE INDEX "security_advisories_source_external_unique" ON "security_advisories" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "security_advisories_risk_type_idx" ON "security_advisories" USING btree ("risk_type");--> statement-breakpoint
CREATE INDEX "security_advisories_modified_at_idx" ON "security_advisories" USING btree ("modified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "security_affected_packages_advisory_package_unique" ON "security_affected_packages" USING btree ("advisory_id","ecosystem","package_key");--> statement-breakpoint
CREATE INDEX "security_affected_packages_lookup_idx" ON "security_affected_packages" USING btree ("ecosystem","package_key");--> statement-breakpoint
CREATE INDEX "security_cve_enrichments_kev_listed_idx" ON "security_cve_enrichments" USING btree ("kev_listed");--> statement-breakpoint
CREATE INDEX "security_cve_enrichments_best_cvss_score_idx" ON "security_cve_enrichments" USING btree ("best_cvss_score");--> statement-breakpoint
CREATE INDEX "security_cve_enrichments_epss_percentile_idx" ON "security_cve_enrichments" USING btree ("epss_percentile");--> statement-breakpoint
CREATE UNIQUE INDEX "security_sync_state_source_scope_unique" ON "security_sync_state" USING btree ("source","scope");--> statement-breakpoint
CREATE INDEX "security_sync_state_status_idx" ON "security_sync_state" USING btree ("status");