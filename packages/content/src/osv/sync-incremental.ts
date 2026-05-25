import fs from "node:fs/promises";

import { createLogger, SecuritySyncStatus } from "@vibeguard/shared";

import {
  buildOsvVulnerabilityUrl,
  deleteCachedOsvFile,
  downloadOsvTextToCache,
} from "./cache";
import { normalizeOsvRecord } from "./normalize";
import { upsertNormalizedOsvRecord, upsertSecuritySyncState } from "./store";
import {
  ensureTextSizeLimit,
  MAX_MODIFIED_ID_CSV_BYTES,
  MAX_MODIFIED_ID_ROW_LIMIT,
  MAX_VULNERABILITY_TEXT_BYTES,
  sha256,
  toSecurityPackageEcosystem,
  type SyncOsvEcosystemInput,
  type SyncOsvEcosystemSummary,
} from "./sync-types";
import {
  buildModifiedIdCsvUrl,
  defaultFetchText,
  parseModifiedIdCsv,
} from "./sync-utils";

const log = createLogger("osv/sync");

export async function syncOsvEcosystem({
  db,
  ecosystem,
  repoRoot,
  limit = 20,
  now = () => new Date(),
  fetchText = defaultFetchText,
  upsertNormalizedOsvRecord: upsertRecord = upsertNormalizedOsvRecord,
  upsertSecuritySyncState: upsertSyncState = upsertSecuritySyncState,
}: SyncOsvEcosystemInput): Promise<SyncOsvEcosystemSummary> {
  const syncedAt = now();
  const packageEcosystem = toSecurityPackageEcosystem(ecosystem);

  await upsertSyncState(db, packageEcosystem, {
    status: SecuritySyncStatus.RUNNING,
    now: syncedAt,
  });

  log.info(`开始增量同步 ${ecosystem}，下载 modified_id.csv…`);
  const modifiedCsv = await fetchText(
    buildModifiedIdCsvUrl(ecosystem),
    MAX_MODIFIED_ID_CSV_BYTES,
  );
  const effectiveLimit = Math.min(
    Math.max(0, limit ?? Number.POSITIVE_INFINITY),
    MAX_MODIFIED_ID_ROW_LIMIT,
  );
  const rows = parseModifiedIdCsv(modifiedCsv, Math.max(0, effectiveLimit));
  log.info(
    `${ecosystem}: 解析到 ${rows.length} 条变更记录，开始逐条处理…`,
  );
  const fetchTextForVulnerability = (url: string) =>
    fetchText(url, MAX_VULNERABILITY_TEXT_BYTES);
  let recordsImported = 0;
  let recordsNew = 0;
  let recordsChanged = 0;
  let recordsSkipped = 0;
  let recordsFailed = 0;
  let lastProcessedModifiedAt: Date | null = null;

  for (const row of rows) {
    const sourceUrl = buildOsvVulnerabilityUrl(ecosystem, row.externalId);
    const filePath = await downloadOsvTextToCache({
      repoRoot,
      ecosystem,
      fileName: `${row.externalId}.json`,
      url: sourceUrl,
      fetchText: fetchTextForVulnerability,
    });

    try {
      const rawText = await fs.readFile(filePath, "utf8");
      ensureTextSizeLimit(
        rawText,
        `OSV advisory ${row.externalId}`,
        MAX_VULNERABILITY_TEXT_BYTES,
      );
      const vulnerability = JSON.parse(rawText);
      if (
        typeof vulnerability !== "object" ||
        vulnerability === null ||
        Array.isArray(vulnerability)
      ) {
        throw new Error(
          `Invalid OSV record: expected an object, got ${typeof vulnerability}`,
        );
      }

      const normalized = normalizeOsvRecord(vulnerability, {
        sourceUrl,
        rawHash: sha256(rawText),
      });

      const result = await upsertRecord(db, normalized);
      await deleteCachedOsvFile(filePath);
      recordsImported += result.skipped ? 0 : 1;
      recordsNew += result.writeKind === "new" ? 1 : 0;
      recordsChanged += result.writeKind === "changed" ? 1 : 0;
      recordsSkipped += result.skipped ? 1 : 0;
      lastProcessedModifiedAt =
        !lastProcessedModifiedAt ||
        row.modifiedAt.getTime() > lastProcessedModifiedAt.getTime()
          ? row.modifiedAt
          : lastProcessedModifiedAt;
    } catch (error) {
      recordsFailed += 1;
      await deleteCachedOsvFile(filePath).catch(() => {});
      log.error(`Failed to process ${row.externalId}:`, error);
      continue;
    }
  }

  const syncStatus =
    recordsFailed === 0
      ? SecuritySyncStatus.SUCCESS
      : SecuritySyncStatus.FAILED;

  await upsertSyncState(db, packageEcosystem, {
    status: syncStatus,
    now: syncedAt,
    lastProcessedModifiedAt,
    lastError:
      recordsFailed > 0 ? `${recordsFailed} OSV records failed to sync.` : null,
    recordsSeen: rows.length,
    recordsImported,
    recordsFailed,
  });

  return {
    ecosystem,
    recordsSeen: rows.length,
    recordsImported,
    recordsNew,
    recordsChanged,
    recordsSkipped,
    recordsFailed,
    lastProcessedModifiedAt,
  };
}
