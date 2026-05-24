import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  schema,
  securityAdvisories,
  securityAffectedPackages,
  securitySyncState,
} from "@vibeguard/db";
import {
  SecuritySyncStatus,
  type SecuritySyncStatus as SecuritySyncStatusValue,
} from "@vibeguard/shared";

import type {
  NormalizedOsvAdvisory,
  NormalizedOsvAffectedPackage,
  NormalizedOsvRecord,
} from "./normalize";

type ContentDb = NodePgDatabase<typeof schema>;

type StoreTables = {
  securityAdvisories: typeof securityAdvisories;
  securityAffectedPackages: typeof securityAffectedPackages;
  securitySyncState: typeof securitySyncState;
};

type UpsertOptions = {
  tables?: Partial<StoreTables>;
  affectedPackageInsertChunkSize?: number;
};

// EXCLUDED.* 引用的是硬编码的列名（而非用户输入），因此不存在 SQL 注入风险，可以安全使用。
// 使用 sql`` 模板标签而非 sql.raw()，是为了与项目中 Drizzle ORM 的编码惯例保持一致。
const advisoryConflictUpdateSet = {
  sourceUrl: sql`excluded.source_url`,
  rawHash: sql`excluded.raw_hash`,
  riskType: sql`excluded.risk_type`,
  summary: sql`excluded.summary`,
  details: sql`excluded.details`,
  aliases: sql`excluded.aliases`,
  relatedIds: sql`excluded.related_ids`,
  upstreamIds: sql`excluded.upstream_ids`,
  severity: sql`excluded.severity`,
  publishedAt: sql`excluded.published_at`,
  modifiedAt: sql`excluded.modified_at`,
  withdrawnAt: sql`excluded.withdrawn_at`,
  references: sql`excluded.references`,
  maliciousOrigins: sql`excluded.malicious_origins`,
};

const DEFAULT_AFFECTED_PACKAGE_INSERT_CHUNK_SIZE = 1000;

function chunkArray<T>(values: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

export type UpsertNormalizedOsvRecordResult = {
  advisoryId: string;
  affectedPackageCount: number;
  skipped: boolean;
  writeKind: "new" | "changed" | null;
};

export type UpsertNormalizedOsvRecordsBatchResult = {
  importedCount: number;
  newCount: number;
  changedCount: number;
  skippedCount: number;
  results: UpsertNormalizedOsvRecordResult[];
};

export type SecuritySyncStateUpdateInput = {
  source?: string;
  status: SecuritySyncStatusValue;
  now: Date;
  lastProcessedModifiedAt?: Date | null;
  cursorJson?: Record<string, unknown> | null;
  lastError?: string | null;
  recordsSeen?: number;
  recordsImported?: number;
  recordsFailed?: number;
};

export function buildSecurityAdvisoryInsert(advisory: NormalizedOsvAdvisory) {
  return {
    source: advisory.source,
    externalId: advisory.externalId,
    sourceUrl: advisory.sourceUrl,
    rawHash: advisory.rawHash,
    riskType: advisory.riskType,
    summary: advisory.summary,
    details: advisory.details,
    aliases: advisory.aliases,
    relatedIds: advisory.relatedIds,
    upstreamIds: advisory.upstreamIds,
    severity: advisory.severity,
    publishedAt: advisory.publishedAt,
    modifiedAt: advisory.modifiedAt,
    withdrawnAt: advisory.withdrawnAt,
    references: advisory.references,
    maliciousOrigins: advisory.maliciousOrigins,
  };
}

export function buildSecurityAffectedPackageInsert(
  affectedPackage: NormalizedOsvAffectedPackage,
  advisoryId: string,
) {
  return {
    advisoryId,
    ecosystem: affectedPackage.ecosystem,
    packageName: affectedPackage.packageName,
    packageKey: affectedPackage.packageKey,
    purl: affectedPackage.purl,
    affectedVersions: affectedPackage.affectedVersions,
    ranges: affectedPackage.ranges,
    fixedVersions: affectedPackage.fixedVersions,
  };
}

export function buildSecuritySyncStateUpdate({
  status,
  now,
  lastProcessedModifiedAt,
  cursorJson,
  lastError,
  recordsSeen = 0,
  recordsImported = 0,
  recordsFailed,
}: SecuritySyncStateUpdateInput) {
  const failedCount =
    recordsFailed ?? (status === SecuritySyncStatus.FAILED ? 1 : 0);

  return {
    status,
    lastProcessedModifiedAt: lastProcessedModifiedAt ?? undefined,
    cursorJson: cursorJson ?? undefined,
    lastStartedAt: status === SecuritySyncStatus.RUNNING ? now : undefined,
    lastSuccessAt: status === SecuritySyncStatus.SUCCESS ? now : undefined,
    lastError: status === SecuritySyncStatus.FAILED ? (lastError ?? "") : null,
    recordsSeen,
    recordsImported,
    recordsFailed: failedCount,
  };
}

export async function upsertNormalizedOsvRecord(
  db: ContentDb,
  normalized: NormalizedOsvRecord,
  options: UpsertOptions = {},
): Promise<UpsertNormalizedOsvRecordResult> {
  const result = await upsertNormalizedOsvRecordsBatch(
    db,
    [normalized],
    options,
  );

  const firstResult = result.results[0];

  if (!firstResult) {
    throw new Error(
      `Unable to upsert OSV advisory: ${normalized.advisory.externalId}`,
    );
  }

  return firstResult;
}

export async function upsertNormalizedOsvRecordsBatch(
  db: ContentDb,
  normalizedRecords: NormalizedOsvRecord[],
  options: UpsertOptions = {},
): Promise<UpsertNormalizedOsvRecordsBatchResult> {
  if (normalizedRecords.length === 0) {
    return {
      importedCount: 0,
      newCount: 0,
      changedCount: 0,
      skippedCount: 0,
      results: [],
    };
  }

  const advisoriesTable =
    options.tables?.securityAdvisories ?? securityAdvisories;
  const affectedPackagesTable =
    options.tables?.securityAffectedPackages ?? securityAffectedPackages;
  const affectedPackageInsertChunkSize = Math.max(
    1,
    Math.floor(
      options.affectedPackageInsertChunkSize ??
        DEFAULT_AFFECTED_PACKAGE_INSERT_CHUNK_SIZE,
    ),
  );

  const externalIds = Array.from(
    new Set(normalizedRecords.map((record) => record.advisory.externalId)),
  );
  const source = normalizedRecords[0]!.advisory.source;
  const existingAdvisories = await db
    .select({
      id: advisoriesTable.id,
      externalId: advisoriesTable.externalId,
      sourceUrl: advisoriesTable.sourceUrl,
      rawHash: advisoriesTable.rawHash,
      details: advisoriesTable.details,
      relatedIds: advisoriesTable.relatedIds,
      upstreamIds: advisoriesTable.upstreamIds,
      maliciousOrigins: advisoriesTable.maliciousOrigins,
    })
    .from(advisoriesTable)
    .where(
      and(
        eq(advisoriesTable.source, source),
        inArray(advisoriesTable.externalId, externalIds),
      ),
    );

  const existingByExternalId = new Map(
    existingAdvisories.map((advisory) => [advisory.externalId, advisory]),
  );
  const resultsByExternalId = new Map<
    string,
    UpsertNormalizedOsvRecordResult
  >();
  const recordsToWrite: NormalizedOsvRecord[] = [];
  let skippedCount = 0;

  for (const record of normalizedRecords) {
    const existing = existingByExternalId.get(record.advisory.externalId);

    if (
      existing?.id &&
      existing.rawHash &&
      record.advisory.rawHash &&
      existing.rawHash === record.advisory.rawHash &&
      existing.sourceUrl === record.advisory.sourceUrl &&
      existing.details === record.advisory.details &&
      JSON.stringify(existing.relatedIds ?? []) ===
        JSON.stringify(record.advisory.relatedIds) &&
      JSON.stringify(existing.upstreamIds ?? []) ===
        JSON.stringify(record.advisory.upstreamIds) &&
      JSON.stringify(existing.maliciousOrigins ?? []) ===
        JSON.stringify(record.advisory.maliciousOrigins)
    ) {
      skippedCount += 1;
      resultsByExternalId.set(record.advisory.externalId, {
        advisoryId: existing.id,
        affectedPackageCount: record.affectedPackages.length,
        skipped: true,
        writeKind: null,
      });
      continue;
    }

    recordsToWrite.push(record);
  }

  if (recordsToWrite.length === 0) {
    return {
      importedCount: 0,
      newCount: 0,
      changedCount: 0,
      skippedCount,
      results: normalizedRecords.map((record) => {
        const result = resultsByExternalId.get(record.advisory.externalId);

        if (!result) {
          throw new Error(
            `Missing skipped advisory result: ${record.advisory.externalId}`,
          );
        }

        return result;
      }),
    };
  }

  const advisoryInsertValues = recordsToWrite.map((record) =>
    buildSecurityAdvisoryInsert(record.advisory),
  );
  const upsertedAdvisories = await db
    .insert(advisoriesTable)
    .values(advisoryInsertValues)
    .onConflictDoUpdate({
      target: [advisoriesTable.source, advisoriesTable.externalId],
      set: advisoryConflictUpdateSet,
    })
    .returning({
      id: advisoriesTable.id,
      externalId: advisoriesTable.externalId,
    });

  const advisoryIdByExternalId = new Map(
    upsertedAdvisories.map((advisory) => [advisory.externalId, advisory.id]),
  );
  const advisoryIdsToRewrite: string[] = [];
  const affectedPackageInsertValues: Array<
    ReturnType<typeof buildSecurityAffectedPackageInsert>
  > = [];
  let newCount = 0;
  let changedCount = 0;

  for (const record of recordsToWrite) {
    const advisoryId = advisoryIdByExternalId.get(record.advisory.externalId);
    const writeKind = existingByExternalId.has(record.advisory.externalId)
      ? "changed"
      : "new";

    if (!advisoryId) {
      throw new Error(
        `Unable to upsert OSV advisory: ${record.advisory.externalId}`,
      );
    }

    if (writeKind === "new") {
      newCount += 1;
    } else {
      changedCount += 1;
    }
    advisoryIdsToRewrite.push(advisoryId);
    resultsByExternalId.set(record.advisory.externalId, {
      advisoryId,
      affectedPackageCount: record.affectedPackages.length,
      skipped: false,
      writeKind,
    });
    affectedPackageInsertValues.push(
      ...record.affectedPackages.map((affectedPackage) =>
        buildSecurityAffectedPackageInsert(affectedPackage, advisoryId),
      ),
    );
  }

  if (advisoryIdsToRewrite.length > 0) {
    await db
      .delete(affectedPackagesTable)
      .where(inArray(affectedPackagesTable.advisoryId, advisoryIdsToRewrite));
  }

  if (affectedPackageInsertValues.length > 0) {
    for (const chunk of chunkArray(
      affectedPackageInsertValues,
      affectedPackageInsertChunkSize,
    )) {
      await db
        .insert(affectedPackagesTable)
        .values(chunk)
        .onConflictDoNothing();
    }
  }

  return {
    importedCount: recordsToWrite.length,
    newCount,
    changedCount,
    skippedCount,
    results: normalizedRecords.map((record) => {
      const result = resultsByExternalId.get(record.advisory.externalId);

      if (!result) {
        throw new Error(
          `Missing advisory upsert result: ${record.advisory.externalId}`,
        );
      }

      return result;
    }),
  };
}

export async function upsertSecuritySyncState(
  db: ContentDb,
  scope: string,
  input: SecuritySyncStateUpdateInput,
  options: UpsertOptions = {},
) {
  const syncStateTable = options.tables?.securitySyncState ?? securitySyncState;
  const values = {
    source: input.source ?? "osv",
    scope,
    ...buildSecuritySyncStateUpdate(input),
  };

  await db
    .insert(syncStateTable)
    .values(values)
    .onConflictDoUpdate({
      target: [syncStateTable.source, syncStateTable.scope],
      set: values,
    })
}
