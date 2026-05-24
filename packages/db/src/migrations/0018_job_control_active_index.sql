DROP INDEX IF EXISTS "processing_jobs_active_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "processing_jobs_active_unique" ON "processing_jobs" USING btree ("article_id","job_type") WHERE "processing_jobs"."status" <> 'succeeded' and "processing_jobs"."status" <> 'failed';
