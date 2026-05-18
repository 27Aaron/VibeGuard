ALTER TABLE "llm_settings" ADD COLUMN "summary_prompt_en" text;--> statement-breakpoint
ALTER TABLE "llm_settings" ADD COLUMN "summary_prompt_zh" text;--> statement-breakpoint
UPDATE "llm_settings"
SET
  "summary_prompt_en" = CASE
    WHEN btrim("summary_prompt") = '' THEN 'Write a concise English summary that highlights the key security development, affected ecosystem, and why it matters.'
    WHEN "summary_prompt" = 'Write a concise summary in Chinese that highlights the key security development, affected ecosystem, and why it matters.' THEN 'Write a concise English summary that highlights the key security development, affected ecosystem, and why it matters.'
    ELSE "summary_prompt"
  END,
  "summary_prompt_zh" = CASE
    WHEN btrim("summary_prompt") = '' THEN 'Write a concise Simplified Chinese summary that highlights the key security development, affected ecosystem, and why it matters.'
    WHEN "summary_prompt" = 'Write a concise summary in Chinese that highlights the key security development, affected ecosystem, and why it matters.' THEN 'Write a concise Simplified Chinese summary that highlights the key security development, affected ecosystem, and why it matters.'
    ELSE "summary_prompt"
  END;--> statement-breakpoint
ALTER TABLE "llm_settings" ALTER COLUMN "summary_prompt_en" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_settings" ALTER COLUMN "summary_prompt_zh" SET NOT NULL;
