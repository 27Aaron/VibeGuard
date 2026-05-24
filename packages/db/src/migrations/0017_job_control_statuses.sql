ALTER TYPE "public"."job_status" ADD VALUE IF NOT EXISTS 'paused';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE IF NOT EXISTS 'pause_requested';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE IF NOT EXISTS 'cancel_requested';
