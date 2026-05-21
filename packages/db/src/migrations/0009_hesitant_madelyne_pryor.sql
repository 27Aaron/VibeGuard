CREATE TYPE "public"."security_package_ecosystem" AS ENUM('npm', 'pypi', 'go', 'crates-io');--> statement-breakpoint
CREATE TYPE "public"."security_parse_status" AS ENUM('pending', 'parsed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."security_risk_type" AS ENUM('unknown', 'vulnerability', 'malicious-package');--> statement-breakpoint
CREATE TYPE "public"."security_sync_status" AS ENUM('idle', 'running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "security_advisories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_record_id" uuid,
	"source" varchar(32) DEFAULT 'osv' NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"risk_type" "security_risk_type" DEFAULT 'unknown' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"details" text,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"severity" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"modified_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_affected_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisory_id" uuid NOT NULL,
	"ecosystem" "security_package_ecosystem" NOT NULL,
	"package_name" text NOT NULL,
	"package_key" text NOT NULL,
	"purl" text,
	"affected_versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fixed_versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(32) DEFAULT 'osv' NOT NULL,
	"external_id" varchar(160) NOT NULL,
	"source_url" text NOT NULL,
	"source_ecosystems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schema_version" varchar(32),
	"modified_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"raw_hash" varchar(128),
	"raw_size_bytes" integer,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parse_status" "security_parse_status" DEFAULT 'pending' NOT NULL,
	"parse_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(32) DEFAULT 'osv' NOT NULL,
	"ecosystem" "security_package_ecosystem" NOT NULL,
	"status" "security_sync_status" DEFAULT 'idle' NOT NULL,
	"last_processed_modified_at" timestamp with time zone,
	"last_started_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"records_seen" integer DEFAULT 0 NOT NULL,
	"records_imported" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_advisories" ADD CONSTRAINT "security_advisories_source_record_id_security_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."security_source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_affected_packages" ADD CONSTRAINT "security_affected_packages_advisory_id_security_advisories_id_fk" FOREIGN KEY ("advisory_id") REFERENCES "public"."security_advisories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "security_advisories_source_external_unique" ON "security_advisories" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "security_advisories_risk_type_idx" ON "security_advisories" USING btree ("risk_type");--> statement-breakpoint
CREATE INDEX "security_advisories_modified_at_idx" ON "security_advisories" USING btree ("modified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "security_affected_packages_advisory_package_unique" ON "security_affected_packages" USING btree ("advisory_id","ecosystem","package_key");--> statement-breakpoint
CREATE INDEX "security_affected_packages_lookup_idx" ON "security_affected_packages" USING btree ("ecosystem","package_key");--> statement-breakpoint
CREATE UNIQUE INDEX "security_source_records_source_external_unique" ON "security_source_records" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "security_source_records_modified_at_idx" ON "security_source_records" USING btree ("modified_at");--> statement-breakpoint
CREATE INDEX "security_source_records_parse_status_idx" ON "security_source_records" USING btree ("parse_status");--> statement-breakpoint
CREATE UNIQUE INDEX "security_sync_state_source_ecosystem_unique" ON "security_sync_state" USING btree ("source","ecosystem");--> statement-breakpoint
CREATE INDEX "security_sync_state_status_idx" ON "security_sync_state" USING btree ("status");