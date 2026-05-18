ALTER TABLE "articles" ADD COLUMN "ecosystem" varchar(32) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "risk_category" varchar(32) DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "articles_ecosystem_idx" ON "articles" USING btree ("ecosystem");--> statement-breakpoint
CREATE INDEX "articles_risk_category_idx" ON "articles" USING btree ("risk_category");