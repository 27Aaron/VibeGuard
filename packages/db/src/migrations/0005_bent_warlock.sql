ALTER TYPE "public"."job_pipeline_stage" ADD VALUE IF NOT EXISTS 'completed';--> statement-breakpoint
UPDATE "processing_jobs"
SET "pipeline_stage" = 'completed'
WHERE "status" = 'succeeded';
