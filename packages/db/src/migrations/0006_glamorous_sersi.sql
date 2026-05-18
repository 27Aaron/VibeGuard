ALTER TABLE "llm_settings" ADD COLUMN "tag_prompt" text DEFAULT 'Extract short supply-chain security tags as strict JSON.' NOT NULL;--> statement-breakpoint
UPDATE "articles" SET "tags" = '[]'::jsonb;
