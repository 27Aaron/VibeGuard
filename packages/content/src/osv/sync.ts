import crypto from "node:crypto"
import fs from "node:fs/promises"

import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { schema } from "@vibeguard/db"
import {
  SecuritySyncStatus,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared"

import {
  buildOsvCachePath,
  buildOsvVulnerabilityUrl,
  deleteCachedOsvFile,
  downloadOsvTextToCache,
  OSV_VULNERABILITIES_BASE_URL,
  type OsvDumpEcosystem,
  OSV_DUMP_ECOSYSTEMS,
} from "./cache"
import { normalizeOsvRecord } from "./normalize"
import {
  upsertNormalizedOsvRecord,
  upsertSecuritySyncState,
  type SecuritySyncStateUpdateInput,
} from "./store"

type ContentDb = NodePgDatabase<typeof schema>

type FetchText = (url: string) => Promise<string>

type SyncOsvEcosystemInput = {
  db: ContentDb
  ecosystem: OsvDumpEcosystem
  repoRoot?: string
  limit?: number
  now?: () => Date
  fetchText?: FetchText
  upsertNormalizedOsvRecord?: typeof upsertNormalizedOsvRecord
  upsertSecuritySyncState?: (
    db: ContentDb,
    ecosystem: SecurityPackageEcosystem,
    input: SecuritySyncStateUpdateInput,
  ) => Promise<void>
}

type SyncAllOsvEcosystemsInput = Omit<SyncOsvEcosystemInput, "ecosystem"> & {
  ecosystems?: readonly OsvDumpEcosystem[]
  syncOne?: (input: SyncOsvEcosystemInput) => Promise<SyncOsvEcosystemSummary>
}

export type SyncOsvEcosystemSummary = {
  ecosystem: OsvDumpEcosystem
  recordsSeen: number
  recordsImported: number
  recordsFailed: number
  lastProcessedModifiedAt: Date | null
}

export type ModifiedIdRow = {
  modifiedAt: Date
  externalId: string
}

function parseOsvTimestamp(value: string) {
  const normalized = value.replace(
    /\.(\d{3})\d*Z$/,
    (_match, millis: string) => `.${millis}Z`,
  )
  const parsed = new Date(normalized)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toSecurityPackageEcosystem(
  ecosystem: OsvDumpEcosystem,
): SecurityPackageEcosystem {
  if (ecosystem === "PyPI") {
    return "pypi"
  }

  if (ecosystem === "crates.io") {
    return "crates-io"
  }

  if (ecosystem === "Go") {
    return "go"
  }

  return ecosystem
}

async function defaultFetchText(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download OSV file: ${response.status} ${url}`)
  }

  return response.text()
}

export function buildModifiedIdCsvUrl(ecosystem: OsvDumpEcosystem) {
  return `${OSV_VULNERABILITIES_BASE_URL}/${encodeURIComponent(
    ecosystem,
  )}/modified_id.csv`
}

export function parseModifiedIdCsv(csv: string): ModifiedIdRow[] {
  return csv
    .split(/\r?\n/)
    .flatMap((line): ModifiedIdRow[] => {
      const [timestamp, externalId] = line.split(",")
      const modifiedAt = timestamp ? parseOsvTimestamp(timestamp.trim()) : null
      const trimmedId = externalId?.trim()

      if (!modifiedAt || !trimmedId) {
        return []
      }

      return [{ modifiedAt, externalId: trimmedId }]
    })
}

function sha256(text: string) {
  return `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`
}

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
  const syncedAt = now()
  const packageEcosystem = toSecurityPackageEcosystem(ecosystem)

  await upsertSyncState(db, packageEcosystem, {
    status: SecuritySyncStatus.RUNNING,
    now: syncedAt,
  })

  const modifiedCsv = await fetchText(buildModifiedIdCsvUrl(ecosystem))
  const rows = parseModifiedIdCsv(modifiedCsv).slice(0, Math.max(0, limit))
  let recordsImported = 0
  let recordsFailed = 0
  let lastProcessedModifiedAt: Date | null = null

  for (const row of rows) {
    const sourceUrl = buildOsvVulnerabilityUrl(ecosystem, row.externalId)
    const filePath = await downloadOsvTextToCache({
      repoRoot,
      ecosystem,
      fileName: `${row.externalId}.json`,
      url: sourceUrl,
      fetchText,
    })

    try {
      const rawText = await fs.readFile(filePath, "utf8")
      const vulnerability = JSON.parse(rawText)
      const normalized = normalizeOsvRecord(vulnerability, {
        sourceUrl,
        dumpEcosystems: [ecosystem],
        rawHash: sha256(rawText),
        rawSizeBytes: Buffer.byteLength(rawText),
        syncedAt,
      })

      await upsertRecord(db, normalized)
      await deleteCachedOsvFile(filePath)
      recordsImported += 1
      lastProcessedModifiedAt =
        !lastProcessedModifiedAt ||
        row.modifiedAt.getTime() > lastProcessedModifiedAt.getTime()
          ? row.modifiedAt
          : lastProcessedModifiedAt
    } catch (error) {
      recordsFailed += 1
      await deleteCachedOsvFile(filePath)
      // Continue syncing newer records; the summary and sync state expose failures.
      void error
    }
  }

  await upsertSyncState(db, packageEcosystem, {
    status: recordsFailed > 0 ? SecuritySyncStatus.FAILED : SecuritySyncStatus.SUCCESS,
    now: syncedAt,
    lastProcessedModifiedAt,
    lastError: recordsFailed > 0 ? `${recordsFailed} OSV records failed to sync.` : null,
    recordsSeen: rows.length,
    recordsImported,
    recordsFailed,
  })

  return {
    ecosystem,
    recordsSeen: rows.length,
    recordsImported,
    recordsFailed,
    lastProcessedModifiedAt,
  }
}

export async function syncAllOsvEcosystems({
  ecosystems = OSV_DUMP_ECOSYSTEMS,
  syncOne = syncOsvEcosystem,
  ...input
}: SyncAllOsvEcosystemsInput) {
  const results = []

  for (const ecosystem of ecosystems) {
    results.push(await syncOne({ ...input, ecosystem }))
  }

  return results
}
