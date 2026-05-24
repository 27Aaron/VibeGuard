import { sql } from "drizzle-orm";

import { securityCveEnrichments } from "@vibeguard/db";

import type {
  ContentDb,
  SecurityCveEnrichmentPatch,
  UpsertSecurityCveEnrichmentsOptions,
} from "./enrichment-types";

function buildSecurityCveEnrichmentInsert(patch: SecurityCveEnrichmentPatch) {
  return {
    cveId: patch.cveId,
    title: patch.title,
    description: patch.description,
    cvssMetrics: patch.cvssMetrics,
    bestCvssScore: patch.bestCvssScore,
    bestCvssSeverity: patch.bestCvssSeverity,
    cweIds: patch.cweIds,
    epss: patch.epss,
    epssPercentile: patch.epssPercentile,
    epssScoreDate: patch.epssScoreDate,
    epssModelVersion: patch.epssModelVersion,
    kevListed: patch.kevListed,
    kevDateAdded: patch.kevDateAdded,
    kevDueDate: patch.kevDueDate,
    kevKnownRansomwareCampaignUse: patch.kevKnownRansomwareCampaignUse,
    kevRequiredAction: patch.kevRequiredAction,
    kevVendorProject: patch.kevVendorProject,
    kevProduct: patch.kevProduct,
    kevNotes: patch.kevNotes,
    nvdPublishedAt: patch.nvdPublishedAt,
    nvdModifiedAt: patch.nvdModifiedAt,
  };
}

const cveEnrichmentConflictUpdateSet = {
  title: sql`coalesce(excluded.title, security_cve_enrichments.title)`,
  description: sql`coalesce(excluded.description, security_cve_enrichments.description)`,
  cvssMetrics: sql`case when excluded.cvss_metrics <> '[]'::jsonb then excluded.cvss_metrics else security_cve_enrichments.cvss_metrics end`,
  bestCvssScore: sql`coalesce(excluded.best_cvss_score, security_cve_enrichments.best_cvss_score)`,
  bestCvssSeverity: sql`coalesce(excluded.best_cvss_severity, security_cve_enrichments.best_cvss_severity)`,
  cweIds: sql`case when excluded.cwe_ids <> '[]'::jsonb then excluded.cwe_ids else security_cve_enrichments.cwe_ids end`,
  epss: sql`coalesce(excluded.epss, security_cve_enrichments.epss)`,
  epssPercentile: sql`coalesce(excluded.epss_percentile, security_cve_enrichments.epss_percentile)`,
  epssScoreDate: sql`coalesce(excluded.epss_score_date, security_cve_enrichments.epss_score_date)`,
  epssModelVersion: sql`coalesce(excluded.epss_model_version, security_cve_enrichments.epss_model_version)`,
  kevListed: sql`excluded.kev_listed or security_cve_enrichments.kev_listed`,
  kevDateAdded: sql`coalesce(excluded.kev_date_added, security_cve_enrichments.kev_date_added)`,
  kevDueDate: sql`coalesce(excluded.kev_due_date, security_cve_enrichments.kev_due_date)`,
  kevKnownRansomwareCampaignUse: sql`coalesce(excluded.kev_known_ransomware_campaign_use, security_cve_enrichments.kev_known_ransomware_campaign_use)`,
  kevRequiredAction: sql`coalesce(excluded.kev_required_action, security_cve_enrichments.kev_required_action)`,
  kevVendorProject: sql`coalesce(excluded.kev_vendor_project, security_cve_enrichments.kev_vendor_project)`,
  kevProduct: sql`coalesce(excluded.kev_product, security_cve_enrichments.kev_product)`,
  kevNotes: sql`coalesce(excluded.kev_notes, security_cve_enrichments.kev_notes)`,
  nvdPublishedAt: sql`coalesce(excluded.nvd_published_at, security_cve_enrichments.nvd_published_at)`,
  nvdModifiedAt: sql`coalesce(excluded.nvd_modified_at, security_cve_enrichments.nvd_modified_at)`,
  updatedAt: sql`now()`,
};

const DEFAULT_CVE_ENRICHMENT_BATCH_SIZE = 500;

function resolveBatchSize(value: number | undefined) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return DEFAULT_CVE_ENRICHMENT_BATCH_SIZE;
  }

  return Math.floor(value);
}

export async function upsertSecurityCveEnrichments(
  db: ContentDb,
  patches: SecurityCveEnrichmentPatch[],
  options: UpsertSecurityCveEnrichmentsOptions = {},
) {
  if (patches.length === 0) {
    return { importedCount: 0 };
  }

  const table = options.table ?? securityCveEnrichments;
  const batchSize = resolveBatchSize(options.batchSize);
  let importedCount = 0;

  for (let index = 0; index < patches.length; index += batchSize) {
    const values = patches
      .slice(index, index + batchSize)
      .map(buildSecurityCveEnrichmentInsert);

    await db
      .insert(table)
      .values(values)
      .onConflictDoUpdate({
        target: table.cveId,
        set: cveEnrichmentConflictUpdateSet,
      })
    importedCount += values.length;
  }

  return { importedCount };
}
