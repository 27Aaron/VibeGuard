CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('extract', 'translate', 'summarize');--> statement-breakpoint
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
	"summary_prompt" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"job_type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
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
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_canonical_url_unique" ON "articles" USING btree ("canonical_url") WHERE "articles"."canonical_url" is not null;--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at" desc);--> statement-breakpoint
CREATE INDEX "articles_feed_id_idx" ON "articles" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feeds_enabled_idx" ON "feeds" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "feeds_last_polled_at_idx" ON "feeds" USING btree ("last_polled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "llm_settings_active_unique" ON "llm_settings" USING btree ("is_active") WHERE "llm_settings"."is_active" = true;--> statement-breakpoint
CREATE INDEX "processing_jobs_status_run_after_idx" ON "processing_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_jobs_active_unique" ON "processing_jobs" USING btree ("article_id","job_type") WHERE "processing_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE TRIGGER "feeds_set_updated_at"
BEFORE UPDATE ON "feeds"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "articles_set_updated_at"
BEFORE UPDATE ON "articles"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "processing_jobs_set_updated_at"
BEFORE UPDATE ON "processing_jobs"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();--> statement-breakpoint
CREATE TRIGGER "llm_settings_set_updated_at"
BEFORE UPDATE ON "llm_settings"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
