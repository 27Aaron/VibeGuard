CREATE TYPE "public"."job_pipeline_stage" AS ENUM('waiting', 'fetch_source', 'extract_content', 'translate_title', 'translate_content', 'summarize_en', 'summarize_zh');--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "pipeline_stage" "job_pipeline_stage" DEFAULT 'waiting' NOT NULL;--> statement-breakpoint
CREATE INDEX "processing_jobs_pipeline_stage_idx" ON "processing_jobs" USING btree ("pipeline_stage");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_jobs_article_job_type_unique" ON "processing_jobs" USING btree ("article_id","job_type");