ALTER TYPE "public"."article_status" ADD VALUE 'filtered';--> statement-breakpoint
ALTER TYPE "public"."job_pipeline_stage" ADD VALUE 'classify_relevance' BEFORE 'translate_title';--> statement-breakpoint
ALTER TABLE "llm_settings" ADD COLUMN "relevance_prompt" text DEFAULT '判断以下文章是否与软件供应链安全、开源安全、依赖安全、恶意包、漏洞利用等相关。只输出 JSON：{"relevant": true/false, "reason": "简短理由"}' NOT NULL;