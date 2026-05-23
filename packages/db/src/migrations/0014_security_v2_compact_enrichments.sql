ALTER TABLE "security_sync_state" ADD COLUMN IF NOT EXISTS "scope" varchar(64) DEFAULT 'global' NOT NULL;--> statement-breakpoint
UPDATE "security_sync_state" SET "scope" = "ecosystem"::text WHERE "scope" = 'global' AND "ecosystem" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "security_sync_state" ADD COLUMN IF NOT EXISTS "cursor_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "security_sync_state_source_ecosystem_unique";--> statement-breakpoint
ALTER TABLE "security_sync_state" DROP COLUMN IF EXISTS "ecosystem";--> statement-breakpoint
CREATE UNIQUE INDEX "security_sync_state_source_scope_unique" ON "security_sync_state" USING btree ("source","scope");--> statement-breakpoint
CREATE TABLE "security_cve_enrichments" (
	"cve_id" varchar(32) PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"cvss_metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"best_cvss_score" numeric(3, 1),
	"best_cvss_severity" varchar(16),
	"cwe_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"epss" numeric(6, 5),
	"epss_percentile" numeric(6, 5),
	"epss_score_date" timestamp with time zone,
	"epss_model_version" varchar(40),
	"kev_listed" boolean DEFAULT false NOT NULL,
	"kev_date_added" timestamp with time zone,
	"kev_due_date" timestamp with time zone,
	"kev_known_ransomware_campaign_use" varchar(32),
	"kev_required_action" text,
	"kev_vendor_project" text,
	"kev_product" text,
	"kev_notes" text,
	"nvd_published_at" timestamp with time zone,
	"nvd_modified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "security_cve_enrichments_kev_listed_idx" ON "security_cve_enrichments" USING btree ("kev_listed");--> statement-breakpoint
CREATE INDEX "security_cve_enrichments_best_cvss_score_idx" ON "security_cve_enrichments" USING btree ("best_cvss_score");--> statement-breakpoint
CREATE INDEX "security_cve_enrichments_epss_percentile_idx" ON "security_cve_enrichments" USING btree ("epss_percentile");
