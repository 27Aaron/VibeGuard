import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { schema, securityCveEnrichments } from "@vibeguard/db";
import { SecuritySyncStatus } from "@vibeguard/shared";

import {
  buildSecuritySyncStateUpdate,
  upsertSecuritySyncState,
  type SecuritySyncStateUpdateInput,
} from "../osv/store";
import { normalizeInt } from "../shared/normalize";

type ContentDb = NodePgDatabase<typeof schema>;

export const CISA_KEV_JSON_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
export const FIRST_EPSS_CURRENT_CSV_GZ_URL =
  "https://epss.cyentia.com/epss_scores-current.csv.gz";
export const NVD_FEED_BASE_URL = "https://nvd.nist.gov/feeds/json/cve/2.0";
export const NVD_MODIFIED_FEED_URL = `${NVD_FEED_BASE_URL}/nvdcve-2.0-modified.json.gz`;
export const NVD_FULL_FEED_START_YEAR = 2002;

const MEBIBYTE = 1024 * 1024;
export const DEFAULT_CISA_KEV_JSON_BYTES = 8 * MEBIBYTE;
export const DEFAULT_EPSS_CSV_GZ_BYTES = 16 * MEBIBYTE;
export const DEFAULT_EPSS_CSV_TEXT_BYTES = 64 * MEBIBYTE;
export const DEFAULT_NVD_FEED_GZ_BYTES = 64 * MEBIBYTE;
export const DEFAULT_NVD_FEED_JSON_BYTES = 512 * MEBIBYTE;

const MAX_CISA_KEV_JSON_BYTES = normalizeInt(
  process.env.VIBEGUARD_CISA_KEV_JSON_BYTES,
  DEFAULT_CISA_KEV_JSON_BYTES,
);
const MAX_EPSS_CSV_GZ_BYTES = normalizeInt(
  process.env.VIBEGUARD_EPSS_CSV_GZ_BYTES,
  DEFAULT_EPSS_CSV_GZ_BYTES,
);
const MAX_EPSS_CSV_TEXT_BYTES = normalizeInt(
  process.env.VIBEGUARD_EPSS_CSV_TEXT_BYTES,
  DEFAULT_EPSS_CSV_TEXT_BYTES,
);
const MAX_NVD_FEED_GZ_BYTES = normalizeInt(
  process.env.VIBEGUARD_NVD_FEED_GZ_BYTES,
  DEFAULT_NVD_FEED_GZ_BYTES,
);
const MAX_NVD_FEED_JSON_BYTES = normalizeInt(
  process.env.VIBEGUARD_NVD_FEED_JSON_BYTES,
  DEFAULT_NVD_FEED_JSON_BYTES,
);

export type SecurityCveEnrichmentPatch = {
  cveId: string;
  title?: string | null;
  description?: string | null;
  cvssMetrics?: Array<{
    source?: string;
    version?: string;
    vector?: string;
    baseScore?: string;
    baseSeverity?: string;
    exploitabilityScore?: string;
    impactScore?: string;
  }>;
  bestCvssScore?: string | null;
  bestCvssSeverity?: string | null;
  cweIds?: string[];
  epss?: string | null;
  epssPercentile?: string | null;
  epssScoreDate?: Date | null;
  epssModelVersion?: string | null;
  kevListed?: boolean;
  kevDateAdded?: Date | null;
  kevDueDate?: Date | null;
  kevKnownRansomwareCampaignUse?: string | null;
  kevRequiredAction?: string | null;
  kevVendorProject?: string | null;
  kevProduct?: string | null;
  kevNotes?: string | null;
  nvdPublishedAt?: Date | null;
  nvdModifiedAt?: Date | null;
};

type UpsertSecurityCveEnrichmentsOptions = {
  table?: typeof securityCveEnrichments;
  batchSize?: number;
};

export type SecurityEnrichmentSyncSummary = {
  source: string;
  scope: string;
  recordsSeen: number;
  recordsImported: number;
  recordsFailed: number;
};

export type SecurityEnrichmentSyncMode = "bootstrap" | "incremental";

type SyncNvdYearFeedInput = {
  db: ContentDb;
  year: number;
  fetchBytes?: typeof defaultFetchBytes;
};

type SyncNvdFullHistoryInput = {
  db: ContentDb;
  years?: number[];
  now?: () => Date;
  fetchBytes?: typeof defaultFetchBytes;
  syncNvdYearFeed?: (
    input: SyncNvdYearFeedInput,
  ) => Promise<SecurityEnrichmentSyncSummary>;
  upsertSecuritySyncState?: (
    db: ContentDb,
    scope: string,
    input: SecuritySyncStateUpdateInput,
  ) => Promise<void>;
};

type SyncAllSecurityEnrichmentSourcesOptions = {
  mode?: SecurityEnrichmentSyncMode;
  nvdYears?: number[];
  fetchText?: typeof defaultFetchText;
  fetchBytes?: typeof defaultFetchBytes;
  syncCisaKevCatalog?: typeof syncCisaKevCatalog;
  syncFirstEpssScores?: typeof syncFirstEpssScores;
  syncNvdModifiedFeed?: typeof syncNvdModifiedFeed;
  syncNvdFullHistory?: typeof syncNvdFullHistory;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDecimalString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? value.trim() : null;
  }

  return null;
}

function parseDate(value: unknown) {
  const text = toStringOrNull(value);
  if (!text) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00.000Z`
    : text.endsWith("Z")
      ? text
      : `${text}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function isCveId(value: unknown): value is string {
  return typeof value === "string" && /^CVE-\d{4}-\d{4,}$/i.test(value.trim());
}

function normalizeCveId(value: string) {
  return value.trim().toUpperCase();
}

function firstEnglishDescription(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    if (
      isRecord(item) &&
      item.lang === "en" &&
      typeof item.value === "string" &&
      item.value.trim()
    ) {
      return item.value.trim();
    }
  }

  return null;
}

export function buildNvdModifiedFeedUrl() {
  return NVD_MODIFIED_FEED_URL;
}

export function buildNvdYearFeedUrl(year: number) {
  return `${NVD_FEED_BASE_URL}/nvdcve-2.0-${year}.json.gz`;
}

export function parseKevCatalog(rawJson: string): SecurityCveEnrichmentPatch[] {
  const parsed = JSON.parse(rawJson);
  if (!isRecord(parsed) || !Array.isArray(parsed.vulnerabilities)) {
    throw new Error("Invalid CISA KEV catalog payload.");
  }

  return parsed.vulnerabilities.flatMap((entry) => {
    if (!isRecord(entry) || !isCveId(entry.cveID)) {
      return [];
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
    };
  });
}

export function parseEpssCsv(csv: string): SecurityCveEnrichmentPatch[] {
  const lines = csv.split(/\r?\n/);
  const firstComment = lines.find((line) => line.startsWith("#")) ?? "";
  const modelVersion =
    firstComment.match(/model_version:([^,\s]+)/)?.[1]?.trim() ?? null;
  const scoreDate = parseDate(
    firstComment.match(/score_date:([^,\s]+)/)?.[1]?.trim(),
  );
  const dataLines = lines.filter(
    (line) => line.trim() && !line.startsWith("#"),
  );
  const header = dataLines.shift()?.trim();

  if (header !== "cve,epss,percentile") {
    throw new Error("Invalid FIRST EPSS CSV header.");
  }

  return dataLines.flatMap((line) => {
    const [cve, epss, percentile] = line.split(",");
    if (!isCveId(cve)) {
      return [];
    }

    return {
      cveId: normalizeCveId(cve),
      epss: toDecimalString(epss),
      epssPercentile: toDecimalString(percentile),
      epssScoreDate: scoreDate,
      epssModelVersion: modelVersion,
    };
  });
}

function normalizeCvssMetric(source: string, metric: unknown) {
  if (!isRecord(metric) || !isRecord(metric.cvssData)) {
    return null;
  }

  const cvssData = metric.cvssData;
  const baseScore = toDecimalString(cvssData.baseScore);
  const baseSeverity = toStringOrNull(cvssData.baseSeverity);

  return {
    source: "nvd",
    version:
      toStringOrNull(cvssData.version) ?? source.replace("cvssMetricV", ""),
    vector: toStringOrNull(cvssData.vectorString) ?? undefined,
    baseScore: baseScore ?? undefined,
    baseSeverity: baseSeverity ?? undefined,
    exploitabilityScore:
      toDecimalString(metric.exploitabilityScore) ?? undefined,
    impactScore: toDecimalString(metric.impactScore) ?? undefined,
  };
}

function extractCvssMetrics(metrics: unknown) {
  if (!isRecord(metrics)) {
    return [];
  }

  return Object.entries(metrics).flatMap(([key, value]) => {
    if (!Array.isArray(value) || !key.startsWith("cvssMetric")) {
      return [];
    }

    return value.flatMap((metric) => normalizeCvssMetric(key, metric) ?? []);
  });
}

function selectBestCvssMetric(
  cvssMetrics: ReturnType<typeof extractCvssMetrics>,
) {
  return [...cvssMetrics].sort((left, right) => {
    const leftScore = Number.parseFloat(left.baseScore ?? "0");
    const rightScore = Number.parseFloat(right.baseScore ?? "0");
    return rightScore - leftScore;
  })[0];
}

function extractCweIds(weaknesses: unknown) {
  if (!Array.isArray(weaknesses)) {
    return [];
  }

  return uniqueStrings(
    weaknesses.flatMap((weakness) => {
      if (!isRecord(weakness) || !Array.isArray(weakness.description)) {
        return [];
      }

      return weakness.description.flatMap((description) => {
        if (
          isRecord(description) &&
          typeof description.value === "string" &&
          /^CWE-\d+$/i.test(description.value.trim())
        ) {
          return description.value.trim().toUpperCase();
        }

        return [];
      });
    }),
  );
}

export function parseNvdModifiedFeed(
  payload: unknown,
): SecurityCveEnrichmentPatch[] {
  if (!isRecord(payload) || !Array.isArray(payload.vulnerabilities)) {
    throw new Error("Invalid NVD modified feed payload.");
  }

  return payload.vulnerabilities.flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.cve) || !isCveId(entry.cve.id)) {
      return [];
    }

    const cve = entry.cve;
    const cveId = typeof cve.id === "string" ? cve.id : "";
    const cvssMetrics = extractCvssMetrics(cve.metrics);
    const bestCvss = selectBestCvssMetric(cvssMetrics);
    const description = firstEnglishDescription(cve.descriptions);

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
    };
  });
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
      .returning();

    importedCount += values.length;
  }

  return { importedCount };
}

async function readResponseBytes(
  response: Response,
  url: string,
  maxBytes: number,
) {
  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(
      `Security feed ${url} is too large (${contentLength} bytes, max ${maxBytes})`,
    );
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new Error(
        `Security feed ${url} is too large (${bytes.byteLength} bytes, max ${maxBytes})`,
      );
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(
        `Security feed ${url} is too large (${total} bytes, max ${maxBytes})`,
      );
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
}

export async function fetchSecurityFeedBytes(url: string, maxBytes: number) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to download ${url}: ${response.status}`);
  return readResponseBytes(response, url, maxBytes);
}

export async function fetchSecurityFeedText(url: string, maxBytes: number) {
  const bytes = await fetchSecurityFeedBytes(url, maxBytes);
  return Buffer.from(bytes).toString("utf8");
}

export async function gunzipSecurityFeedText(
  bytes: Uint8Array,
  label: string,
  maxBytes: number,
) {
  const chunks: Buffer[] = [];
  let total = 0;

  await pipeline(
    Readable.from(Buffer.from(bytes)),
    zlib.createGunzip(),
    new Writable({
      write(chunk, _encoding, callback) {
        total += chunk.byteLength;
        if (total > maxBytes) {
          callback(
            new Error(
              `${label} is too large after decompression (${total} bytes, max ${maxBytes})`,
            ),
          );
          return;
        }

        chunks.push(Buffer.from(chunk));
        callback();
      },
    }),
  );

  return Buffer.concat(chunks, total).toString("utf8");
}

async function defaultFetchText(
  url: string,
  maxBytes = MAX_CISA_KEV_JSON_BYTES,
) {
  return fetchSecurityFeedText(url, maxBytes);
}

async function defaultFetchBytes(
  url: string,
  maxBytes = MAX_NVD_FEED_GZ_BYTES,
) {
  return fetchSecurityFeedBytes(url, maxBytes);
}

async function syncPatches({
  db,
  source,
  scope,
  patches,
  cursorJson,
}: {
  db: ContentDb;
  source: string;
  scope: string;
  patches: SecurityCveEnrichmentPatch[];
  cursorJson?: Record<string, unknown>;
}): Promise<SecurityEnrichmentSyncSummary> {
  const now = new Date();
  await upsertSecuritySyncState(db, scope, {
    source,
    status: SecuritySyncStatus.RUNNING,
    now,
  });

  try {
    const result = await upsertSecurityCveEnrichments(db, patches);
    await upsertSecuritySyncState(db, scope, {
      source,
      status: SecuritySyncStatus.SUCCESS,
      now,
      cursorJson,
      recordsSeen: patches.length,
      recordsImported: result.importedCount,
      recordsFailed: 0,
    });
    return {
      source,
      scope,
      recordsSeen: patches.length,
      recordsImported: result.importedCount,
      recordsFailed: 0,
    };
  } catch (error) {
    await upsertSecuritySyncState(db, scope, {
      source,
      status: SecuritySyncStatus.FAILED,
      now,
      lastError: error instanceof Error ? error.message : String(error),
      recordsSeen: patches.length,
      recordsImported: 0,
      recordsFailed: patches.length || 1,
    });
    throw error;
  }
}

export async function syncCisaKevCatalog({
  db,
  fetchText = defaultFetchText,
}: {
  db: ContentDb;
  fetchText?: typeof defaultFetchText;
}) {
  console.log("[enrichment] 正在下载 CISA KEV 漏洞目录…");
  const rawJson = await fetchText(CISA_KEV_JSON_URL, MAX_CISA_KEV_JSON_BYTES);
  const patches = parseKevCatalog(rawJson);
  console.log(
    `[enrichment] CISA KEV: 解析到 ${patches.length} 条漏洞，开始写入…`,
  );
  return syncPatches({
    db,
    source: "cisa-kev",
    scope: "global",
    cursorJson: {
      mode: "snapshot",
      url: CISA_KEV_JSON_URL,
    },
    patches,
  });
}

export async function syncFirstEpssScores({
  db,
  fetchBytes = defaultFetchBytes,
}: {
  db: ContentDb;
  fetchBytes?: typeof defaultFetchBytes;
}) {
  console.log("[enrichment] 正在下载 FIRST EPSS 评分数据…");
  const bytes = await fetchBytes(
    FIRST_EPSS_CURRENT_CSV_GZ_URL,
    MAX_EPSS_CSV_GZ_BYTES,
  );
  const csv = await gunzipSecurityFeedText(
    bytes,
    "FIRST EPSS current CSV",
    MAX_EPSS_CSV_TEXT_BYTES,
  );
  const patches = parseEpssCsv(csv);
  console.log(`[enrichment] EPSS: 解析到 ${patches.length} 条评分，开始写入…`);
  const scoreDate = patches.find((patch) => patch.epssScoreDate)?.epssScoreDate;
  const modelVersion = patches.find(
    (patch) => patch.epssModelVersion,
  )?.epssModelVersion;
  return syncPatches({
    db,
    source: "first-epss",
    scope: "current",
    cursorJson: {
      mode: "snapshot",
      url: FIRST_EPSS_CURRENT_CSV_GZ_URL,
      ...(scoreDate ? { scoreDate: scoreDate.toISOString() } : {}),
      ...(modelVersion ? { modelVersion } : {}),
    },
    patches,
  });
}

export async function syncNvdModifiedFeed({
  db,
  fetchBytes = defaultFetchBytes,
}: {
  db: ContentDb;
  fetchBytes?: typeof defaultFetchBytes;
}) {
  console.log("[enrichment] 正在下载 NVD 增量数据（modified feed）…");
  const bytes = await fetchBytes(
    buildNvdModifiedFeedUrl(),
    MAX_NVD_FEED_GZ_BYTES,
  );
  const payload = JSON.parse(
    await gunzipSecurityFeedText(
      bytes,
      "NVD modified feed",
      MAX_NVD_FEED_JSON_BYTES,
    ),
  );
  const patches = parseNvdModifiedFeed(payload);
  console.log(
    `[enrichment] NVD modified: 解析到 ${patches.length} 条 CVE，开始写入…`,
  );
  return syncPatches({
    db,
    source: "nvd",
    scope: "modified",
    cursorJson: {
      mode: "incremental",
      url: buildNvdModifiedFeedUrl(),
    },
    patches,
  });
}

export async function syncNvdYearFeed({
  db,
  year,
  fetchBytes = defaultFetchBytes,
}: SyncNvdYearFeedInput) {
  const bytes = await fetchBytes(
    buildNvdYearFeedUrl(year),
    MAX_NVD_FEED_GZ_BYTES,
  );
  const payload = JSON.parse(
    await gunzipSecurityFeedText(
      bytes,
      `NVD ${year} feed`,
      MAX_NVD_FEED_JSON_BYTES,
    ),
  );
  const patches = parseNvdModifiedFeed(payload);
  console.log(`[enrichment] NVD ${year}: 解析到 ${patches.length} 条 CVE，开始写入…`);
  return syncPatches({
    db,
    source: "nvd",
    scope: `year-${year}`,
    cursorJson: {
      mode: "bootstrap",
      year,
      url: buildNvdYearFeedUrl(year),
    },
    patches,
  });
}

function resolveNvdFullYears(years: number[] | undefined, now: Date) {
  const currentYear = now.getUTCFullYear();
  const resolvedYears =
    years && years.length > 0
      ? years
      : Array.from(
          { length: currentYear - NVD_FULL_FEED_START_YEAR + 1 },
          (_value, index) => NVD_FULL_FEED_START_YEAR + index,
        );

  return Array.from(
    new Set(
      resolvedYears
        .map((year) => Math.floor(year))
        .filter(
          (year) => year >= NVD_FULL_FEED_START_YEAR && year <= currentYear,
        ),
    ),
  ).sort((left, right) => left - right);
}

export async function syncNvdFullHistory({
  db,
  years,
  now = () => new Date(),
  fetchBytes,
  syncNvdYearFeed: syncYear = syncNvdYearFeed,
  upsertSecuritySyncState: upsertSyncState = upsertSecuritySyncState,
}: SyncNvdFullHistoryInput): Promise<SecurityEnrichmentSyncSummary> {
  const startedAt = now();
  const resolvedYears = resolveNvdFullYears(years, startedAt);

  await upsertSyncState(db, "full", {
    source: "nvd",
    status: SecuritySyncStatus.RUNNING,
    now: startedAt,
    cursorJson: {
      mode: "bootstrap",
      years: resolvedYears,
    },
  });

  try {
    console.log(
      `[enrichment] 开始 NVD 全量引导，共 ${resolvedYears.length} 个年份（${resolvedYears[0]}–${resolvedYears[resolvedYears.length - 1]}）`,
    );
    const results: SecurityEnrichmentSyncSummary[] = [];
    for (const year of resolvedYears) {
      console.log(`[enrichment]   正在下载 NVD ${year} 年数据…`);
      results.push(
        await syncYear({
          db,
          year,
          ...(fetchBytes ? { fetchBytes } : {}),
        }),
      );
    }

    const recordsSeen = results.reduce(
      (total, result) => total + result.recordsSeen,
      0,
    );
    const recordsImported = results.reduce(
      (total, result) => total + result.recordsImported,
      0,
    );
    const recordsFailed = results.reduce(
      (total, result) => total + result.recordsFailed,
      0,
    );
    console.log(
      `[enrichment] NVD 全量引导完成：${resolvedYears.length} 个年份，共 ${recordsSeen} 条（导入=${recordsImported} 失败=${recordsFailed}）`,
    );
    const completedAt = now();

    await upsertSyncState(db, "full", {
      source: "nvd",
      status:
        recordsFailed > 0
          ? SecuritySyncStatus.FAILED
          : SecuritySyncStatus.SUCCESS,
      now: completedAt,
      cursorJson: {
        mode: "bootstrap",
        years: resolvedYears,
        completedAt: completedAt.toISOString(),
      },
      lastError:
        recordsFailed > 0
          ? `${recordsFailed} NVD full-history records failed to sync.`
          : null,
      recordsSeen,
      recordsImported,
      recordsFailed,
    });

    return {
      source: "nvd",
      scope: "full",
      recordsSeen,
      recordsImported,
      recordsFailed,
    };
  } catch (error) {
    await upsertSyncState(db, "full", {
      source: "nvd",
      status: SecuritySyncStatus.FAILED,
      now: now(),
      cursorJson: {
        mode: "bootstrap",
        years: resolvedYears,
      },
      lastError: error instanceof Error ? error.message : String(error),
      recordsSeen: 0,
      recordsImported: 0,
      recordsFailed: 1,
    });
    throw error;
  }
}

export async function syncAllSecurityEnrichmentSources(
  db: ContentDb,
  options: SyncAllSecurityEnrichmentSourcesOptions = {},
) {
  const mode = options.mode ?? "incremental";
  const syncKev = options.syncCisaKevCatalog ?? syncCisaKevCatalog;
  const syncEpss = options.syncFirstEpssScores ?? syncFirstEpssScores;
  const syncModified = options.syncNvdModifiedFeed ?? syncNvdModifiedFeed;
  const syncFull = options.syncNvdFullHistory ?? syncNvdFullHistory;

  return [
    await syncKev({
      db,
      ...(options.fetchText ? { fetchText: options.fetchText } : {}),
    }),
    await syncEpss({
      db,
      ...(options.fetchBytes ? { fetchBytes: options.fetchBytes } : {}),
    }),
    mode === "bootstrap"
      ? await syncFull({
          db,
          ...(options.nvdYears ? { years: options.nvdYears } : {}),
          ...(options.fetchBytes ? { fetchBytes: options.fetchBytes } : {}),
        })
      : await syncModified({
          db,
          ...(options.fetchBytes ? { fetchBytes: options.fetchBytes } : {}),
        }),
  ];
}

export function buildSecurityEnrichmentSyncStateUpdate(
  input: SecuritySyncStateUpdateInput,
) {
  return buildSecuritySyncStateUpdate(input);
}
