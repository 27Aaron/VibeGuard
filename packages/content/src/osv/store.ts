import { eq } from "drizzle-orm"
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
) {
  const advisoriesTable =
    options.tables?.securityAdvisories ?? securityAdvisories
  const affectedPackagesTable =
    options.tables?.securityAffectedPackages ?? securityAffectedPackages

  const existingAdvisory = await db.query.securityAdvisories.findFirst({
    where: (table, { and, eq: whereEq }) =>
      and(
        whereEq(table.source, normalized.advisory.source),
        whereEq(table.externalId, normalized.advisory.externalId),
      ),
    columns: {
      id: true,
      rawHash: true,
    },
  })

  if (
    existingAdvisory?.id &&
    existingAdvisory.rawHash &&
    normalized.advisory.rawHash &&
    existingAdvisory.rawHash === normalized.advisory.rawHash
  ) {
    return {
      advisoryId: existingAdvisory.id,
      affectedPackageCount: normalized.affectedPackages.length,
      skipped: true,
    }
  }

  const advisoryInsert = buildSecurityAdvisoryInsert(normalized.advisory)
  const insertedAdvisories = await db
    .insert(advisoriesTable)
    .values(advisoryInsert)
    .onConflictDoUpdate({
      target: [advisoriesTable.source, advisoriesTable.externalId],
      set: advisoryInsert,
    })
    .returning()
  const advisoryId = insertedAdvisories[0]?.id

  if (!advisoryId) {
    throw new Error(`Unable to upsert OSV advisory: ${advisoryInsert.externalId}`)
  }

  await db
    .delete(affectedPackagesTable)
    .where(eq(affectedPackagesTable.advisoryId, advisoryId))

  if (normalized.affectedPackages.length > 0) {
    await db
      .insert(affectedPackagesTable)
      .values(
        normalized.affectedPackages.map((affectedPackage) =>
          buildSecurityAffectedPackageInsert(affectedPackage, advisoryId),
        ),
      )
      .onConflictDoNothing()
      .returning()
  }

  return {
    advisoryId,
    affectedPackageCount: normalized.affectedPackages.length,
    skipped: false,
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
