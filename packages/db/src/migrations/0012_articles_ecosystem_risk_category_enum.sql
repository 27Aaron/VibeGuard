-- Step 1: Create the enum types
CREATE TYPE "public"."article_ecosystem" AS ENUM('unknown', 'npm', 'pypi', 'maven', 'go', 'crates-io', 'github-actions', 'docker', 'multi');--> statement-breakpoint
CREATE TYPE "public"."article_risk_category" AS ENUM('unknown', 'vulnerability', 'exploit-activity', 'malicious-package', 'supply-chain-attack', 'dependency-risk');--> statement-breakpoint

-- Step 2: Normalize any existing data that doesn't match the enum values
UPDATE "articles"
SET "ecosystem" = 'unknown'
WHERE "ecosystem" NOT IN ('unknown', 'npm', 'pypi', 'maven', 'go', 'crates-io', 'github-actions', 'docker', 'multi');--> statement-breakpoint

UPDATE "articles"
SET "risk_category" = 'unknown'
WHERE "risk_category" NOT IN ('unknown', 'vulnerability', 'exploit-activity', 'malicious-package', 'supply-chain-attack', 'dependency-risk');--> statement-breakpoint

-- Step 3: Drop the existing indexes (they reference the varchar column)
DROP INDEX IF EXISTS "articles_ecosystem_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "articles_risk_category_idx";--> statement-breakpoint

-- Step 4: Alter the columns from varchar to enum
ALTER TABLE "articles"
  ALTER COLUMN "ecosystem" TYPE "article_ecosystem"
  USING "ecosystem"::"article_ecosystem";--> statement-breakpoint

ALTER TABLE "articles"
  ALTER COLUMN "risk_category" TYPE "article_risk_category"
  USING "risk_category"::"article_risk_category";--> statement-breakpoint

-- Step 5: Recreate the indexes
CREATE INDEX "articles_ecosystem_idx" ON "articles" USING btree ("ecosystem");--> statement-breakpoint
CREATE INDEX "articles_risk_category_idx" ON "articles" USING btree ("risk_category");
