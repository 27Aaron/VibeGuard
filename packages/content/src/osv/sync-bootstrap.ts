import { SecuritySyncStatus } from "@vibeguard/shared";

import {
  buildOsvBootstrapArchiveUrl,
  buildOsvVulnerabilityUrl,
  deleteCachedOsvFile,
  downloadOsvArchiveToCache,
} from "./cache";
import { normalizeOsvRecord } from "./normalize";
import {
  upsertNormalizedOsvRecord,
  upsertNormalizedOsvRecordsBatch,
  upsertSecuritySyncState,
} from "./store";
import {
  assertSafeArchivePath,
  DEFAULT_BOOTSTRAP_BATCH_SIZE,
  ensureTextSizeLimit,
  MAX_VULNERABILITY_TEXT_BYTES,
  parseBootstrapEntryId,
  sha256,
  toSecurityPackageEcosystem,
  type BootstrapOsvEcosystemInput,
  type SyncOsvEcosystemSummary,
} from "./sync-types";
import { defaultIterateArchiveEntries } from "./sync-utils";

export async function bootstrapOsvEcosystem({
  db,
  ecosystem,
  repoRoot,
  limit,
  batchSize = DEFAULT_BOOTSTRAP_BATCH_SIZE,
  now = () => new Date(),
  downloadArchiveToCache: downloadArchive = downloadOsvArchiveToCache,
  iterateArchiveEntries = defaultIterateArchiveEntries,
  deleteCachedFile = deleteCachedOsvFile,
  upsertNormalizedOsvRecord: upsertRecord = upsertNormalizedOsvRecord,
  upsertNormalizedOsvRecordsBatch:
    upsertRecordsBatch = upsertNormalizedOsvRecordsBatch,
  upsertSecuritySyncState: upsertSyncState = upsertSecuritySyncState,
}: BootstrapOsvEcosystemInput): Promise<SyncOsvEcosystemSummary> {
  const syncedAt = now();
  const packageEcosystem = toSecurityPackageEcosystem(ecosystem);

  await upsertSyncState(db, packageEcosystem, {
    status: SecuritySyncStatus.RUNNING,
    now: syncedAt,
  });

  console.log(
    `[osv/bootstrap] 开始全量引导 ${ecosystem}，下载 all.zip 压缩包…`,
  );
  const archivePath = assertSafeArchivePath(
    await downloadArchive({
      repoRoot,
      ecosystem,
      fileName: "all.zip",
      url: buildOsvBootstrapArchiveUrl(ecosystem),
    }),
  );
  console.log(`[osv/bootstrap] ${ecosystem}: 压缩包已下载，开始逐条解析…`);

  let recordsSeen = 0;
  let recordsImported = 0;
  let recordsNew = 0;
  let recordsChanged = 0;
  let recordsSkipped = 0;
  let recordsFailed = 0;
  let lastProcessedModifiedAt: Date | null = null;
  let pendingRecords = [] as Array<ReturnType<typeof normalizeOsvRecord>>;
  const effectiveBatchSize = Math.max(1, Math.floor(batchSize));

  async function flushPendingRecords() {
    if (pendingRecords.length === 0) {
      return;
    }

    const batch = pendingRecords;
    pendingRecords = [];

    try {
      const result = await upsertRecordsBatch(db, batch);
      recordsImported += result.importedCount;
      recordsNew += result.newCount;
      recordsChanged += result.changedCount;
      recordsSkipped += result.skippedCount;
      if (recordsSeen > 0 && recordsSeen % 2000 === 0) {
        console.log(
          `[osv/bootstrap] ${ecosystem}: 已处理 ${recordsSeen} 条（导入=${recordsImported} 新增=${recordsNew} 跳过=${recordsSkipped} 失败=${recordsFailed}）`,
        );
      }
      return;
    } catch {
      for (const record of batch) {
        try {
          const result = await upsertRecord(db, record);
          recordsImported += result.skipped ? 0 : 1;
          recordsNew += result.writeKind === "new" ? 1 : 0;
          recordsChanged += result.writeKind === "changed" ? 1 : 0;
          recordsSkipped += result.skipped ? 1 : 0;
        } catch {
          recordsFailed += 1;
        }
      }
    }
  }

  try {
    for await (const entry of await iterateArchiveEntries(archivePath)) {
      const externalId = parseBootstrapEntryId(entry.entryName);

      if (!externalId) {
        continue;
      }

      if (limit && limit > 0 && recordsSeen >= limit) {
        break;
      }

      recordsSeen += 1;

      try {
        const rawText = await entry.readText();
        ensureTextSizeLimit(
          rawText,
          `OSV archive entry ${externalId}`,
          MAX_VULNERABILITY_TEXT_BYTES,
        );
        const vulnerability = JSON.parse(rawText);
        const sourceUrl = buildOsvVulnerabilityUrl(ecosystem, externalId);
        const normalized = normalizeOsvRecord(vulnerability, {
          sourceUrl,
          rawHash: sha256(rawText),
        });

        pendingRecords.push(normalized);
        if (
          normalized.advisory.modifiedAt &&
          (!lastProcessedModifiedAt ||
            normalized.advisory.modifiedAt.getTime() >
              lastProcessedModifiedAt.getTime())
        ) {
          lastProcessedModifiedAt = normalized.advisory.modifiedAt;
        }
        if (pendingRecords.length >= effectiveBatchSize) {
          await flushPendingRecords();
        }
      } catch {
        recordsFailed += 1;
      }
    }

    await flushPendingRecords();
    console.log(
      `[osv/bootstrap] ${ecosystem}: 全量引导完成，共 ${recordsSeen} 条（导入=${recordsImported} 新增=${recordsNew} 变更=${recordsChanged} 失败=${recordsFailed}）`,
    );
  } finally {
    await deleteCachedFile(archivePath);
  }

  await upsertSyncState(db, packageEcosystem, {
    status:
      recordsFailed > 0
        ? SecuritySyncStatus.FAILED
        : SecuritySyncStatus.SUCCESS,
    now: syncedAt,
    lastProcessedModifiedAt,
    lastError:
      recordsFailed > 0
        ? `${recordsFailed} OSV records failed to bootstrap.`
        : null,
    recordsSeen,
    recordsImported,
    recordsFailed,
  });

  return {
    ecosystem,
    recordsSeen,
    recordsImported,
    recordsNew,
    recordsChanged,
    recordsSkipped,
    recordsFailed,
    lastProcessedModifiedAt,
  };
}
