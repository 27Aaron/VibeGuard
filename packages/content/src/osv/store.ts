import { and, eq, inArray, sql } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import {
  schema,
  securityAdvisories,
  securityAffectedPackages,
  securitySyncState,
} from "@vibeguard/db"
import {
  SecuritySyncStatus,
  type SecurityPackageEcosystem,
  type SecuritySyncStatus as SecuritySyncStatusValue,
} from "@vibeguard/shared"

import type {
  NormalizedOsvAdvisory,
  NormalizedOsvAffectedPackage,
  NormalizedOsvRecord,
} from "./normalize"

type ContentDb = NodePgDatabase<typeof schema>

type StoreTables = {
  securityAdvisories: typeof securityAdvisories
  securityAffectedPackages: typeof securityAffectedPackages
  securitySyncState: typeof securitySyncState
}

type UpsertOptions = {
  tables?: Partial<StoreTables>
}

const advisoryConflictUpdateSet = {
  sourceUrl: sql.raw("excluded.source_url"),
  rawHash: sql.raw("excluded.raw_hash"),
  riskType: sql.raw("excluded.risk_type"),
  summary: sql.raw("excluded.summary"),
  details: sql.raw("excluded.details"),
  aliases: sql.raw("excluded.aliases"),
  severity: sql.raw("excluded.severity"),
  publishedAt: sql.raw("excluded.published_at"),
  modifiedAt: sql.raw("excluded.modified_at"),
  withdrawnAt: sql.raw("excluded.withdrawn_at"),
  references: sql.raw("excluded.references"),
}

export type UpsertNormalizedOsvRecordResult = {
  advisoryId: string
  affectedPackageCount: number
  skipped: boolean
}

export type UpsertNormalizedOsvRecordsBatchResult = {
  importedCount: number
  skippedCount: number
  results: UpsertNormalizedOsvRecordResult[]
}

export type SecuritySyncStateUpdateInput = {
  status: SecuritySyncStatusValue
  now: Date
  lastProcessedModifiedAt?: Date | null
  lastError?: string | null
  recordsSeen?: number
  recordsImported?: number
  recordsFailed?: number
}

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
    severity: advisory.severity,
    publishedAt: advisory.publishedAt,
    modifiedAt: advisory.modifiedAt,
    withdrawnAt: advisory.withdrawnAt,
    references: advisory.references,
  }
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
  }
}

export function buildSecuritySyncStateUpdate({
  status,
  now,
  lastProcessedModifiedAt,
  lastError,
  recordsSeen = 0,
  recordsImported = 0,
  recordsFailed,
}: SecuritySyncStateUpdateInput) {
  const failedCount =
    recordsFailed ?? (status === SecuritySyncStatus.FAILED ? 1 : 0)

  return {
    status,
    lastProcessedModifiedAt: lastProcessedModifiedAt ?? undefined,
    lastStartedAt: status === SecuritySyncStatus.RUNNING ? now : undefined,
    lastSuccessAt: status === SecuritySyncStatus.SUCCESS ? now : undefined,
    lastError: status === SecuritySyncStatus.FAILED ? (lastError ?? "") : null,
    recordsSeen,
    recordsImported,
    recordsFailed: failedCount,
  }
}

export async function upsertNormalizedOsvRecord(
  db: ContentDb,
  normalized: NormalizedOsvRecord,
  options: UpsertOptions = {},
) : Promise<UpsertNormalizedOsvRecordResult> {
  const result = await upsertNormalizedOsvRecordsBatch(
    db,
    [normalized],
    options,
  )

  const firstResult = result.results[0]

  if (!firstResult) {
    throw new Error(
      `Unable to upsert OSV advisory: ${normalized.advisory.externalId}`,
    )
  }

  return firstResult
}

export async function upsertNormalizedOsvRecordsBatch(
  db: ContentDb,
  normalizedRecords: NormalizedOsvRecord[],
  options: UpsertOptions = {},
): Promise<UpsertNormalizedOsvRecordsBatchResult> {
  if (normalizedRecords.length === 0) {
    return {
      importedCount: 0,
      skippedCount: 0,
      results: [],
    }
  }

  const advisoriesTable =
    options.tables?.securityAdvisories ?? securityAdvisories
  const affectedPackagesTable =
    options.tables?.securityAffectedPackages ?? securityAffectedPackages

  const externalIds = Array.from(
    new Set(normalizedRecords.map((record) => record.advisory.externalId)),
  )
  const source = normalizedRecords[0]!.advisory.source
  const existingAdvisories = await db
    .select({
      id: advisoriesTable.id,
      externalId: advisoriesTable.externalId,
      rawHash: advisoriesTable.rawHash,
    })
    .from(advisoriesTable)
    .where(
      and(
        eq(advisoriesTable.source, source),
        inArray(advisoriesTable.externalId, externalIds),
      ),
    )

  const existingByExternalId = new Map(
    existingAdvisories.map((advisory) => [advisory.externalId, advisory]),
  )
  const resultsByExternalId = new Map<string, UpsertNormalizedOsvRecordResult>()
  const recordsToWrite: NormalizedOsvRecord[] = []
  let skippedCount = 0

  for (const record of normalizedRecords) {
    const existing = existingByExternalId.get(record.advisory.externalId)

    if (
      existing?.id &&
      existing.rawHash &&
      record.advisory.rawHash &&
      existing.rawHash === record.advisory.rawHash
    ) {
      skippedCount += 1
      resultsByExternalId.set(record.advisory.externalId, {
        advisoryId: existing.id,
        affectedPackageCount: record.affectedPackages.length,
        skipped: true,
      })
      continue
    }

    recordsToWrite.push(record)
  }

  if (recordsToWrite.length === 0) {
    return {
      importedCount: 0,
      skippedCount,
      results: normalizedRecords.map((record) => {
        const result = resultsByExternalId.get(record.advisory.externalId)

        if (!result) {
          throw new Error(
            `Missing skipped advisory result: ${record.advisory.externalId}`,
          )
        }

        return result
      }),
    }
  }

  const advisoryInsertValues = recordsToWrite.map((record) =>
    buildSecurityAdvisoryInsert(record.advisory),
  )
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
    })

  const advisoryIdByExternalId = new Map(
    upsertedAdvisories.map((advisory) => [advisory.externalId, advisory.id]),
  )
  const advisoryIdsToRewrite: string[] = []
  const affectedPackageInsertValues: Array<
    ReturnType<typeof buildSecurityAffectedPackageInsert>
  > = []

  for (const record of recordsToWrite) {
    const advisoryId = advisoryIdByExternalId.get(record.advisory.externalId)

    if (!advisoryId) {
      throw new Error(
        `Unable to upsert OSV advisory: ${record.advisory.externalId}`,
      )
    }

    advisoryIdsToRewrite.push(advisoryId)
    resultsByExternalId.set(record.advisory.externalId, {
      advisoryId,
      affectedPackageCount: record.affectedPackages.length,
      skipped: false,
    })
    affectedPackageInsertValues.push(
      ...record.affectedPackages.map((affectedPackage) =>
        buildSecurityAffectedPackageInsert(affectedPackage, advisoryId),
      ),
    )
  }

  if (advisoryIdsToRewrite.length > 0) {
    await db
      .delete(affectedPackagesTable)
      .where(inArray(affectedPackagesTable.advisoryId, advisoryIdsToRewrite))
  }

  if (affectedPackageInsertValues.length > 0) {
    await db
      .insert(affectedPackagesTable)
      .values(affectedPackageInsertValues)
      .onConflictDoNothing()
      .returning()
  }

  return {
    importedCount: recordsToWrite.length,
    skippedCount,
    results: normalizedRecords.map((record) => {
      const result = resultsByExternalId.get(record.advisory.externalId)

      if (!result) {
        throw new Error(
          `Missing advisory upsert result: ${record.advisory.externalId}`,
        )
      }

      return result
    }),
  }
}

export async function upsertSecuritySyncState(
  db: ContentDb,
  ecosystem: SecurityPackageEcosystem,
  input: SecuritySyncStateUpdateInput,
  options: UpsertOptions = {},
) {
  const syncStateTable = options.tables?.securitySyncState ?? securitySyncState
  const values = {
    source: "osv",
    ecosystem,
    ...buildSecuritySyncStateUpdate(input),
  }

  await db
    .insert(syncStateTable)
    .values(values)
    .onConflictDoUpdate({
      target: [syncStateTable.source, syncStateTable.ecosystem],
      set: values,
    })
    .returning()
}
