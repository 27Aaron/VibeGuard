import zlib from "node:zlib"
import { promisify } from "node:util"

import { sql } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import {
  schema,
  securityCveEnrichments,
} from "@vibeguard/db"
import { SecuritySyncStatus } from "@vibeguard/shared"

import {
  buildSecuritySyncStateUpdate,
  upsertSecuritySyncState,
  type SecuritySyncStateUpdateInput,
} from "../osv/store"

type ContentDb = NodePgDatabase<typeof schema>

const gunzip = promisify(zlib.gunzip)

export const CISA_KEV_JSON_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
export const FIRST_EPSS_CURRENT_CSV_GZ_URL =
  "https://epss.cyentia.com/epss_scores-current.csv.gz"
export const NVD_MODIFIED_FEED_URL =
  "https://nvd.nist.gov/feeds/json/cve/2.0/nvdcve-2.0-modified.json.gz"

export type SecurityCveEnrichmentPatch = {
  cveId: string
  title?: string | null
  description?: string | null
  cvssMetrics?: Array<{
    source?: string
    version?: string
    vector?: string
    baseScore?: string
    baseSeverity?: string
    exploitabilityScore?: string
    impactScore?: string
  }>
  bestCvssScore?: string | null
  bestCvssSeverity?: string | null
  cweIds?: string[]
  epss?: string | null
  epssPercentile?: string | null
  epssScoreDate?: Date | null
  epssModelVersion?: string | null
  kevListed?: boolean
  kevDateAdded?: Date | null
  kevDueDate?: Date | null
  kevKnownRansomwareCampaignUse?: string | null
  kevRequiredAction?: string | null
  kevVendorProject?: string | null
  kevProduct?: string | null
  kevNotes?: string | null
  nvdPublishedAt?: Date | null
  nvdModifiedAt?: Date | null
}

type UpsertSecurityCveEnrichmentsOptions = {
  table?: typeof securityCveEnrichments
  batchSize?: number
}

export type SecurityEnrichmentSyncSummary = {
  source: string
  scope: string
  recordsSeen: number
  recordsImported: number
  recordsFailed: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function toDecimalString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? value.trim() : null
  }

  return null
}

function parseDate(value: unknown) {
  const text = toStringOrNull(value)
  if (!text) return null

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00.000Z`
    : text.endsWith("Z")
      ? text
      : `${text}Z`
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

function isCveId(value: unknown): value is string {
  return typeof value === "string" && /^CVE-\d{4}-\d{4,}$/i.test(value.trim())
}

function normalizeCveId(value: string) {
  return value.trim().toUpperCase()
}

function firstEnglishDescription(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  for (const item of value) {
    if (
      isRecord(item) &&
      item.lang === "en" &&
      typeof item.value === "string" &&
      item.value.trim()
    ) {
      return item.value.trim()
    }
  }

  return null
}

export function buildNvdModifiedFeedUrl() {
  return NVD_MODIFIED_FEED_URL
}

export function parseKevCatalog(rawJson: string): SecurityCveEnrichmentPatch[] {
  const parsed = JSON.parse(rawJson)
  if (!isRecord(parsed) || !Array.isArray(parsed.vulnerabilities)) {
    throw new Error("Invalid CISA KEV catalog payload.")
  }

  return parsed.vulnerabilities.flatMap((entry) => {
    if (!isRecord(entry) || !isCveId(entry.cveID)) {
      return []
    }

    return {
      cveId: normalizeCveId(entry.cveID),
      title: toStringOrNull(entry.vulnerabilityName),
      description: toStringOrNull(entry.shortDescription),
      cweIds: Array.isArray(entry.cwes)
        ? uniqueStrings(entry.cwes.map((value) => toStringOrNull(value)))
        : [],
      kevListed: true,
      kevDateAdded: parseDate(entry.dateAdded),
      kevDueDate: parseDate(entry.dueDate),
      kevKnownRansomwareCampaignUse: toStringOrNull(
        entry.knownRansomwareCampaignUse,
      ),
      kevRequiredAction: toStringOrNull(entry.requiredAction),
      kevVendorProject: toStringOrNull(entry.vendorProject),
      kevProduct: toStringOrNull(entry.product),
      kevNotes: toStringOrNull(entry.notes),
    }
  })
}

export function parseEpssCsv(csv: string): SecurityCveEnrichmentPatch[] {
  const lines = csv.split(/\r?\n/)
  const firstComment = lines.find((line) => line.startsWith("#")) ?? ""
  const modelVersion =
    firstComment.match(/model_version:([^,\s]+)/)?.[1]?.trim() ?? null
  const scoreDate = parseDate(
    firstComment.match(/score_date:([^,\s]+)/)?.[1]?.trim(),
  )
  const dataLines = lines.filter((line) => line.trim() && !line.startsWith("#"))
  const header = dataLines.shift()?.trim()

  if (header !== "cve,epss,percentile") {
    throw new Error("Invalid FIRST EPSS CSV header.")
  }

  return dataLines.flatMap((line) => {
    const [cve, epss, percentile] = line.split(",")
    if (!isCveId(cve)) {
      return []
    }

    return {
      cveId: normalizeCveId(cve),
      epss: toDecimalString(epss),
      epssPercentile: toDecimalString(percentile),
      epssScoreDate: scoreDate,
      epssModelVersion: modelVersion,
    }
  })
}

function normalizeCvssMetric(source: string, metric: unknown) {
  if (!isRecord(metric) || !isRecord(metric.cvssData)) {
    return null
  }

  const cvssData = metric.cvssData
  const baseScore = toDecimalString(cvssData.baseScore)
  const baseSeverity = toStringOrNull(cvssData.baseSeverity)

  return {
    source: "nvd",
    version: toStringOrNull(cvssData.version) ?? source.replace("cvssMetricV", ""),
    vector: toStringOrNull(cvssData.vectorString) ?? undefined,
    baseScore: baseScore ?? undefined,
    baseSeverity: baseSeverity ?? undefined,
    exploitabilityScore: toDecimalString(metric.exploitabilityScore) ?? undefined,
    impactScore: toDecimalString(metric.impactScore) ?? undefined,
  }
}

function extractCvssMetrics(metrics: unknown) {
  if (!isRecord(metrics)) {
    return []
  }

  return Object.entries(metrics).flatMap(([key, value]) => {
    if (!Array.isArray(value) || !key.startsWith("cvssMetric")) {
      return []
    }

    return value.flatMap((metric) => normalizeCvssMetric(key, metric) ?? [])
  })
}

function selectBestCvssMetric(
  cvssMetrics: ReturnType<typeof extractCvssMetrics>,
) {
  return [...cvssMetrics].sort((left, right) => {
    const leftScore = Number.parseFloat(left.baseScore ?? "0")
    const rightScore = Number.parseFloat(right.baseScore ?? "0")
    return rightScore - leftScore
  })[0]
}

function extractCweIds(weaknesses: unknown) {
  if (!Array.isArray(weaknesses)) {
    return []
  }

  return uniqueStrings(
    weaknesses.flatMap((weakness) => {
      if (!isRecord(weakness) || !Array.isArray(weakness.description)) {
        return []
      }

      return weakness.description.flatMap((description) => {
        if (
          isRecord(description) &&
          typeof description.value === "string" &&
          /^CWE-\d+$/i.test(description.value.trim())
        ) {
          return description.value.trim().toUpperCase()
        }

        return []
      })
    }),
  )
}

export function parseNvdModifiedFeed(
  payload: unknown,
): SecurityCveEnrichmentPatch[] {
  if (!isRecord(payload) || !Array.isArray(payload.vulnerabilities)) {
    throw new Error("Invalid NVD modified feed payload.")
  }

  return payload.vulnerabilities.flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.cve) || !isCveId(entry.cve.id)) {
      return []
    }

    const cve = entry.cve
    const cveId = typeof cve.id === "string" ? cve.id : ""
    const cvssMetrics = extractCvssMetrics(cve.metrics)
    const bestCvss = selectBestCvssMetric(cvssMetrics)
    const description = firstEnglishDescription(cve.descriptions)

    return {
      cveId: normalizeCveId(cveId),
      title: description ? description.split(".")[0] : null,
      description,
      cvssMetrics,
      bestCvssScore: bestCvss?.baseScore ?? null,
      bestCvssSeverity: bestCvss?.baseSeverity ?? null,
      cweIds: extractCweIds(cve.weaknesses),
      nvdPublishedAt: parseDate(cve.published),
      nvdModifiedAt: parseDate(cve.lastModified),
    }
  })
}

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
  }
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
}

const DEFAULT_CVE_ENRICHMENT_BATCH_SIZE = 500

function resolveBatchSize(value: number | undefined) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return DEFAULT_CVE_ENRICHMENT_BATCH_SIZE
  }

  return Math.floor(value)
}

export async function upsertSecurityCveEnrichments(
  db: ContentDb,
  patches: SecurityCveEnrichmentPatch[],
  options: UpsertSecurityCveEnrichmentsOptions = {},
) {
  if (patches.length === 0) {
    return { importedCount: 0 }
  }

  const table = options.table ?? securityCveEnrichments
  const batchSize = resolveBatchSize(options.batchSize)
  let importedCount = 0

  for (let index = 0; index < patches.length; index += batchSize) {
    const values = patches
      .slice(index, index + batchSize)
      .map(buildSecurityCveEnrichmentInsert)

    await db
      .insert(table)
      .values(values)
      .onConflictDoUpdate({
        target: table.cveId,
        set: cveEnrichmentConflictUpdateSet,
      })
      .returning()

    importedCount += values.length
  }

  return { importedCount }
}

async function defaultFetchText(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`)
  return response.text()
}

async function defaultFetchBytes(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function syncPatches({
  db,
  source,
  scope,
  patches,
  cursorJson,
}: {
  db: ContentDb
  source: string
  scope: string
  patches: SecurityCveEnrichmentPatch[]
  cursorJson?: Record<string, unknown>
}): Promise<SecurityEnrichmentSyncSummary> {
  const now = new Date()
  await upsertSecuritySyncState(db, scope, {
    source,
    status: SecuritySyncStatus.RUNNING,
    now,
  })

  try {
    const result = await upsertSecurityCveEnrichments(db, patches)
    await upsertSecuritySyncState(db, scope, {
      source,
      status: SecuritySyncStatus.SUCCESS,
      now,
      cursorJson,
      recordsSeen: patches.length,
      recordsImported: result.importedCount,
      recordsFailed: 0,
    })
    return {
      source,
      scope,
      recordsSeen: patches.length,
      recordsImported: result.importedCount,
      recordsFailed: 0,
    }
  } catch (error) {
    await upsertSecuritySyncState(db, scope, {
      source,
      status: SecuritySyncStatus.FAILED,
      now,
      lastError: error instanceof Error ? error.message : String(error),
      recordsSeen: patches.length,
      recordsImported: 0,
      recordsFailed: patches.length || 1,
    })
    throw error
  }
}

export async function syncCisaKevCatalog({
  db,
  fetchText = defaultFetchText,
}: {
  db: ContentDb
  fetchText?: typeof defaultFetchText
}) {
  const rawJson = await fetchText(CISA_KEV_JSON_URL)
  const patches = parseKevCatalog(rawJson)
  return syncPatches({
    db,
    source: "cisa-kev",
    scope: "global",
    patches,
  })
}

export async function syncFirstEpssScores({
  db,
  fetchBytes = defaultFetchBytes,
}: {
  db: ContentDb
  fetchBytes?: typeof defaultFetchBytes
}) {
  const bytes = await fetchBytes(FIRST_EPSS_CURRENT_CSV_GZ_URL)
  const csv = (await gunzip(Buffer.from(bytes))).toString("utf8")
  const patches = parseEpssCsv(csv)
  return syncPatches({
    db,
    source: "first-epss",
    scope: "current",
    patches,
  })
}

export async function syncNvdModifiedFeed({
  db,
  fetchBytes = defaultFetchBytes,
}: {
  db: ContentDb
  fetchBytes?: typeof defaultFetchBytes
}) {
  const bytes = await fetchBytes(buildNvdModifiedFeedUrl())
  const payload = JSON.parse((await gunzip(Buffer.from(bytes))).toString("utf8"))
  const patches = parseNvdModifiedFeed(payload)
  return syncPatches({
    db,
    source: "nvd",
    scope: "modified",
    patches,
  })
}

export async function syncAllSecurityEnrichmentSources(db: ContentDb) {
  return [
    await syncCisaKevCatalog({ db }),
    await syncFirstEpssScores({ db }),
    await syncNvdModifiedFeed({ db }),
  ]
}

export function buildSecurityEnrichmentSyncStateUpdate(
  input: SecuritySyncStateUpdateInput,
) {
  return buildSecuritySyncStateUpdate(input)
}
