import fs from "node:fs"

import { describe, expect, it } from "vitest"

import {
  ARTICLE_ECOSYSTEM_VALUES,
  ARTICLE_RISK_CATEGORY_VALUES,
} from "@vibeguard/shared"

const schemaSource = fs.readFileSync("packages/db/src/schema.ts", "utf8")

// ---------------------------------------------------------------------------
// BUG-01: Duplicate unique index prevents job retry
// ---------------------------------------------------------------------------

describe("BUG-01 — processing_jobs unique index", () => {
  it("does NOT define an unconditional unique index on (articleId, jobType)", () => {
    // The unconditional index "processing_jobs_article_job_type_unique" must not exist
    expect(schemaSource).not.toContain(
      'uniqueIndex("processing_jobs_article_job_type_unique")',
    )
  })

  it("keeps the partial unique index for active jobs (queued/running)", () => {
    // The partial index must still exist to prevent duplicate active jobs
    expect(schemaSource).toContain(
      'uniqueIndex("processing_jobs_active_unique")',
    )
    expect(schemaSource).toContain(
      "in ('queued', 'running')",
    )
  })

  it("has a migration that drops the old unconditional index", () => {
    const migrationSql = fs.readFileSync(
      "packages/db/src/migrations/0011_drop_duplicate_job_unique_index.sql",
      "utf8",
    )
    expect(migrationSql).toContain(
      'DROP INDEX IF EXISTS "processing_jobs_article_job_type_unique"',
    )
  })
})

// ---------------------------------------------------------------------------
// BUG-06: articles ecosystem/riskCategory use pgEnum instead of varchar
// ---------------------------------------------------------------------------

describe("BUG-06 — articles ecosystem and riskCategory enum types", () => {
  it("defines articleEcosystemEnum using pgEnum", () => {
    expect(schemaSource).toMatch(
      /export const articleEcosystemEnum = pgEnum\(/,
    )
    expect(schemaSource).toContain('"article_ecosystem"')
  })

  it("defines articleRiskCategoryEnum using pgEnum", () => {
    expect(schemaSource).toMatch(
      /export const articleRiskCategoryEnum = pgEnum\(/,
    )
    expect(schemaSource).toContain('"article_risk_category"')
  })

  it("uses articleEcosystemEnum for the ecosystem column (not varchar)", () => {
    expect(schemaSource).toContain(
      'ecosystem: articleEcosystemEnum("ecosystem")',
    )
    expect(schemaSource).not.toContain(
      'ecosystem: varchar("ecosystem"',
    )
  })

  it("uses articleRiskCategoryEnum for the risk_category column (not varchar)", () => {
    expect(schemaSource).toContain(
      'riskCategory: articleRiskCategoryEnum("risk_category")',
    )
    expect(schemaSource).not.toContain(
      'riskCategory: varchar("risk_category"',
    )
  })

  it("articleEcosystemEnum values match ARTICLE_ECOSYSTEM_VALUES from shared", () => {
    // The schema should reference articleEcosystemValues which is derived from shared
    expect(schemaSource).toContain("articleEcosystemValues")
  })

  it("articleRiskCategoryEnum values match ARTICLE_RISK_CATEGORY_VALUES from shared", () => {
    expect(schemaSource).toContain("articleRiskCategoryValues")
  })

  it("exports the new enum types in the schema object", () => {
    expect(schemaSource).toContain("articleEcosystemEnum,")
    expect(schemaSource).toContain("articleRiskCategoryEnum,")
  })

  it("has a migration that creates the enum types and alters the columns", () => {
    const migrationSql = fs.readFileSync(
      "packages/db/src/migrations/0012_articles_ecosystem_risk_category_enum.sql",
      "utf8",
    )

    // Should create both enum types
    expect(migrationSql).toContain('"public"."article_ecosystem"')
    expect(migrationSql).toContain('"public"."article_risk_category"')

    // Should normalize invalid data before altering
    expect(migrationSql).toMatch(/UPDATE "articles"[\s\S]*SET "ecosystem" = 'unknown'/)
    expect(migrationSql).toMatch(/UPDATE "articles"[\s\S]*SET "risk_category" = 'unknown'/)

    // Should alter column types
    expect(migrationSql).toMatch(
      /ALTER TABLE "articles"[\s\S]*ALTER COLUMN "ecosystem" TYPE "article_ecosystem"/,
    )
    expect(migrationSql).toMatch(
      /ALTER TABLE "articles"[\s\S]*ALTER COLUMN "risk_category" TYPE "article_risk_category"/,
    )
  })

  it("migration enum values match the shared constants", () => {
    const migrationSql = fs.readFileSync(
      "packages/db/src/migrations/0012_articles_ecosystem_risk_category_enum.sql",
      "utf8",
    )

    // Extract enum values from migration SQL
    const ecosystemMatch = migrationSql.match(
      /CREATE TYPE.*article_ecosystem.*AS ENUM\(([^)]+)\)/,
    )
    const riskCategoryMatch = migrationSql.match(
      /CREATE TYPE.*article_risk_category.*AS ENUM\(([^)]+)\)/,
    )

    expect(ecosystemMatch).not.toBeNull()
    expect(riskCategoryMatch).not.toBeNull()

    // Parse the enum values from the SQL
    const ecosystemValues = ecosystemMatch![1]
      .split(",")
      .map((v: string) => v.trim().replace(/'/g, ""))
    const riskCategoryValues = riskCategoryMatch![1]
      .split(",")
      .map((v: string) => v.trim().replace(/'/g, ""))

    expect(ecosystemValues).toEqual([...ARTICLE_ECOSYSTEM_VALUES])
    expect(riskCategoryValues).toEqual([...ARTICLE_RISK_CATEGORY_VALUES])
  })
})
