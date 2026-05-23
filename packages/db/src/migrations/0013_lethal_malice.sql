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
ALTER TABLE "security_source_records" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "security_source_records" CASCADE;--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT "articles_feed_id_feeds_id_fk";
--> statement-breakpoint
ALTER TABLE "processing_jobs" DROP CONSTRAINT "processing_jobs_article_id_articles_id_fk";
--> statement-breakpoint
ALTER TABLE "security_advisories" DROP CONSTRAINT "security_advisories_source_record_id_security_source_records_id_fk";
--> statement-breakpoint
ALTER TABLE "security_affected_packages" DROP CONSTRAINT "security_affected_packages_advisory_id_security_advisories_id_fk";
--> statement-breakpoint
ALTER TABLE "llm_settings" ALTER COLUMN "relevance_prompt" SET DEFAULT 'Determine whether the article is relevant to software supply-chain security. Output ONLY JSON: {"relevant": true/false, "reason": "one-sentence explanation"}';--> statement-breakpoint
ALTER TABLE "security_advisories" ADD COLUMN "source_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "security_advisories" ADD COLUMN "raw_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_job_id_processing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llm_usage_logs_created_at_idx" ON "llm_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "llm_usage_logs_article_id_idx" ON "llm_usage_logs" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "llm_usage_logs_task_type_idx" ON "llm_usage_logs" USING btree ("task_type");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_affected_packages" ADD CONSTRAINT "security_affected_packages_advisory_id_security_advisories_id_fk" FOREIGN KEY ("advisory_id") REFERENCES "public"."security_advisories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_advisories" DROP COLUMN "source_record_id";--> statement-breakpoint
DROP TYPE "public"."security_parse_status";