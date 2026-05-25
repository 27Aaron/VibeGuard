import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Transform, Writable, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import parserStream from "stream-json";
import pick from "stream-json/filters/pick.js";
import streamArray from "stream-json/streamers/stream-array.js";

import { createLogger, SecuritySyncStatus } from "@vibeguard/shared";

import { deleteCacheFile, downloadToCache } from "./cache";
import { upsertSecurityCveEnrichments } from "./enrichment-db";
import {
  parseEpssCsv,
  parseKevCatalog,
  parseNvdVulnerabilityEntry,
  buildNvdModifiedFeedUrl,
  buildNvdYearFeedUrl,
} from "./enrichment-parsers";
import { gunzipSecurityFeedText } from "./enrichment-fetch";
import {
  buildSecuritySyncStateUpdate,
  upsertSecuritySyncState,
} from "../osv/store";
import type {
  ContentDb,
  SecurityCveEnrichmentPatch,
  SecurityEnrichmentSyncSummary,
  SyncNvdYearFeedInput,
  SyncNvdFullHistoryInput,
  SyncAllSecurityEnrichmentSourcesOptions,
  SecuritySyncStateUpdateInput,
} from "./enrichment-types";
import {
  CISA_KEV_JSON_URL,
  FIRST_EPSS_CURRENT_CSV_GZ_URL,
  MAX_CISA_KEV_JSON_BYTES,
  MAX_EPSS_CSV_GZ_BYTES,
  MAX_EPSS_CSV_TEXT_BYTES,
  MAX_NVD_FEED_GZ_BYTES,
  MAX_NVD_FEED_JSON_BYTES,
  NVD_FULL_FEED_START_YEAR,
} from "./enrichment-types";

const log = createLogger("enrichment");

const DEFAULT_NVD_STREAM_BATCH_SIZE = 500;

type NvdStreamArrayChunk = {
  key: number;
  value: unknown;
};

type StreamNvdGzipFeedPatchesInput = {
  filePath: string;
  label: string;
  batchSize?: number;
  maxBytes?: number;
  onBatch: (patches: SecurityCveEnrichmentPatch[]) => Promise<void>;
};

function resolveNvdStreamBatchSize(value: number | undefined) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return DEFAULT_NVD_STREAM_BATCH_SIZE;
  }

  return Math.floor(value);
}

function createDecompressedByteLimitTransform(label: string, maxBytes: number) {
  let received = 0;

  return new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      received += chunk.byteLength;
      if (received > maxBytes) {
        callback(
          new Error(
            `${label} is too large after decompression (${received} bytes, max ${maxBytes})`,
          ),
        );
        return;
      }

      callback(null, chunk);
    },
  });
}

export async function streamNvdGzipFeedPatches({
  filePath,
  label,
  batchSize,
  maxBytes = MAX_NVD_FEED_JSON_BYTES,
  onBatch,
}: StreamNvdGzipFeedPatchesInput): Promise<
  Pick<
    SecurityEnrichmentSyncSummary,
    "recordsSeen" | "recordsImported" | "recordsFailed"
  >
> {
  const effectiveBatchSize = resolveNvdStreamBatchSize(batchSize);
  let recordsSeen = 0;
  let recordsImported = 0;
  let pendingPatches: SecurityCveEnrichmentPatch[] = [];

  async function flushPendingPatches() {
    if (pendingPatches.length === 0) {
      return;
    }

    const batch = pendingPatches;
    pendingPatches = [];
    await onBatch(batch);
    recordsImported += batch.length;
  }

  async function handleChunk(chunk: NvdStreamArrayChunk) {
    recordsSeen += 1;
    const patch = parseNvdVulnerabilityEntry(chunk.value);

    if (!patch) {
      return;
    }

    pendingPatches.push(patch);
    if (pendingPatches.length >= effectiveBatchSize) {
      await flushPendingPatches();
    }
  }

  await pipeline(
    createReadStream(filePath),
    createGunzip(),
    createDecompressedByteLimitTransform(label, maxBytes),
    parserStream(),
    pick.asStream({ filter: "vulnerabilities" }),
    streamArray.asStream(),
    new Writable({
      objectMode: true,
      write(chunk, _encoding, callback) {
        handleChunk(chunk as NvdStreamArrayChunk).then(
          () => callback(),
          (error: unknown) =>
            callback(error instanceof Error ? error : new Error(String(error))),
        );
      },
    }),
  );

  await flushPendingPatches();

  return {
    recordsSeen,
    recordsImported,
    recordsFailed: 0,
  };
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

export async function syncCisaKevCatalog({ db }: { db: ContentDb }) {
  log.info("正在下载 CISA KEV 漏洞目录…");
  const cached = await downloadToCache({
    url: CISA_KEV_JSON_URL,
    fileName: "cisa-kev.json",
    maxBytes: MAX_CISA_KEV_JSON_BYTES,
  });
  const rawJson = await fs.readFile(cached, "utf8");
  await deleteCacheFile(cached);
  const patches = parseKevCatalog(rawJson);
  log.info(
    `CISA KEV: 解析到 ${patches.length} 条漏洞，开始写入…`,
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

export async function syncFirstEpssScores({ db }: { db: ContentDb }) {
  log.info("正在下载 FIRST EPSS 评分数据…");
  const cached = await downloadToCache({
    url: FIRST_EPSS_CURRENT_CSV_GZ_URL,
    fileName: "epss-current.csv.gz",
    maxBytes: MAX_EPSS_CSV_GZ_BYTES,
  });
  const bytes = await fs.readFile(cached);
  await deleteCacheFile(cached);
  const csv = await gunzipSecurityFeedText(
    bytes,
    "FIRST EPSS current CSV",
    MAX_EPSS_CSV_TEXT_BYTES,
  );
  const patches = parseEpssCsv(csv);
  log.info(`EPSS: 解析到 ${patches.length} 条评分，开始写入…`);
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

export async function syncNvdModifiedFeed({ db }: { db: ContentDb }) {
  log.info("正在下载 NVD 增量数据（modified feed）…");
  const cached = await downloadToCache({
    url: buildNvdModifiedFeedUrl(),
    fileName: "nvd-modified.json.gz",
    maxBytes: MAX_NVD_FEED_GZ_BYTES,
  });
  try {
    return await syncNvdCachedGzipFeed({
      db,
      filePath: cached,
      label: "NVD modified feed",
      scope: "modified",
      cursorJson: {
        mode: "incremental",
        url: buildNvdModifiedFeedUrl(),
      },
    });
  } finally {
    await deleteCacheFile(cached);
  }
}

export async function syncNvdYearFeed({ db, year }: SyncNvdYearFeedInput) {
  const cached = await downloadToCache({
    url: buildNvdYearFeedUrl(year),
    fileName: `nvd-${year}.json.gz`,
    maxBytes: MAX_NVD_FEED_GZ_BYTES,
  });
  try {
    return await syncNvdCachedGzipFeed({
      db,
      filePath: cached,
      label: `NVD ${year} feed`,
      scope: `year-${year}`,
      cursorJson: {
        mode: "bootstrap",
        year,
        url: buildNvdYearFeedUrl(year),
      },
    });
  } finally {
    await deleteCacheFile(cached);
  }
}

async function syncNvdCachedGzipFeed({
  db,
  filePath,
  label,
  scope,
  cursorJson,
}: {
  db: ContentDb;
  filePath: string;
  label: string;
  scope: string;
  cursorJson: Record<string, unknown>;
}): Promise<SecurityEnrichmentSyncSummary> {
  const now = new Date();

  await upsertSecuritySyncState(db, scope, {
    source: "nvd",
    status: SecuritySyncStatus.RUNNING,
    now,
  });

  try {
    log.info(`${label}: 开始流式解析并按批写入…`);
    const result = await streamNvdGzipFeedPatches({
      filePath,
      label,
      onBatch: async (patches) => {
        await upsertSecurityCveEnrichments(db, patches);
      },
    });
    log.info(
      `${label}: 解析到 ${result.recordsSeen} 条 CVE，导入=${result.recordsImported}。`,
    );
    await upsertSecuritySyncState(db, scope, {
      source: "nvd",
      status: SecuritySyncStatus.SUCCESS,
      now,
      cursorJson,
      recordsSeen: result.recordsSeen,
      recordsImported: result.recordsImported,
      recordsFailed: result.recordsFailed,
    });

    return {
      source: "nvd",
      scope,
      recordsSeen: result.recordsSeen,
      recordsImported: result.recordsImported,
      recordsFailed: result.recordsFailed,
    };
  } catch (error) {
    await upsertSecuritySyncState(db, scope, {
      source: "nvd",
      status: SecuritySyncStatus.FAILED,
      now,
      cursorJson,
      lastError: error instanceof Error ? error.message : String(error),
      recordsSeen: 0,
      recordsImported: 0,
      recordsFailed: 1,
    });
    throw error;
  }
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
  syncNvdYearFeed: syncYear = syncNvdYearFeed,
  upsertSecuritySyncState: upsertSyncState = upsertSecuritySyncState,
}: SyncNvdFullHistoryInput): Promise<SecurityEnrichmentSyncSummary> {
  const startedAt = now();
  const resolvedYears = resolveNvdFullYears(years, startedAt);

  if (resolvedYears.length === 0) {
    const emptySummary: SecurityEnrichmentSyncSummary = {
      source: "nvd",
      scope: "full",
      recordsSeen: 0,
      recordsImported: 0,
      recordsFailed: 0,
    };
    await upsertSyncState(db, "full", {
      source: "nvd",
      status: SecuritySyncStatus.SUCCESS,
      now: startedAt,
      cursorJson: { mode: "bootstrap", years: [] },
    });
    return emptySummary;
  }

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
    log.info(
      `开始 NVD 全量引导，共 ${resolvedYears.length} 个年份（${resolvedYears[0]}–${resolvedYears[resolvedYears.length - 1]}）`,
    );
    const results: SecurityEnrichmentSyncSummary[] = [];
    const concurrency = Math.max(
      1,
      Math.min(
        Number(process.env.VIBEGUARD_NVD_CONCURRENCY) || 1,
        4,
      ),
    );
    const queue = [...resolvedYears];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const year = queue.shift();
        if (year != null) {
          log.info(`  正在下载 NVD ${year} 年数据…`);
          results.push(await syncYear({ db, year }));
        }
      }
    });
    await Promise.all(workers);

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
    log.info(
      `NVD 全量引导完成：${resolvedYears.length} 个年份，共 ${recordsSeen} 条（导入=${recordsImported} 失败=${recordsFailed}）`,
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

  if (mode === "bootstrap") {
    const kevResult = await syncKev({ db });
    const epssResult = await syncEpss({ db });
    const nvdResult = await syncFull({
      db,
      ...(options.nvdYears ? { years: options.nvdYears } : {}),
    });

    return [kevResult, epssResult, nvdResult];
  }

  const nvdTask = syncModified({ db });

  const [kevResult, epssResult, nvdResult] = await Promise.all([
    syncKev({ db }),
    syncEpss({ db }),
    nvdTask,
  ]);

  return [kevResult, epssResult, nvdResult];
}

export function buildSecurityEnrichmentSyncStateUpdate(
  input: SecuritySyncStateUpdateInput,
) {
  return buildSecuritySyncStateUpdate(input);
}
