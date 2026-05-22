import crypto from "node:crypto"
import { execFile as execFileCallback } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import { schema } from "@vibeguard/db"
import {
  SecuritySyncStatus,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared"

import {
  buildOsvBootstrapArchiveUrl,
  buildOsvBootstrapPath,
  buildOsvCachePath,
  buildOsvVulnerabilityUrl,
  deleteCachedOsvFile,
  downloadOsvArchiveToCache,
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
type FetchBytes = (url: string) => Promise<Uint8Array>
type ExecFile = (
  file: string,
  args: string[],
  options?: {
    maxBuffer?: number
  },
) => Promise<{
  stdout: string | Buffer
  stderr: string | Buffer
}>

const execFile = promisify(execFileCallback)
const UNZIP_MAX_BUFFER_BYTES = 64 * 1024 * 1024

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

type BootstrapOsvEcosystemInput = {
  db: ContentDb
  ecosystem: OsvDumpEcosystem
  repoRoot?: string
  limit?: number
  now?: () => Date
  fetchBytes?: FetchBytes
  downloadArchiveToCache?: typeof downloadOsvArchiveToCache
  extractArchiveToDirectory?: (
    archivePath: string,
    targetDirectory: string,
  ) => Promise<void>
  listExtractedEntries?: (targetDirectory: string) => Promise<string[]>
  readExtractedEntryText?: (
    targetDirectory: string,
    entryName: string,
  ) => Promise<string>
  deleteCachedFile?: typeof deleteCachedOsvFile
  upsertNormalizedOsvRecord?: typeof upsertNormalizedOsvRecord
  upsertSecuritySyncState?: (
    db: ContentDb,
    ecosystem: SecurityPackageEcosystem,
    input: SecuritySyncStateUpdateInput,
  ) => Promise<void>
}

type BootstrapAllOsvEcosystemsInput = Omit<
  BootstrapOsvEcosystemInput,
  "ecosystem"
> & {
  ecosystems?: readonly OsvDumpEcosystem[]
  concurrency?: number
  syncOne?: (
    input: BootstrapOsvEcosystemInput,
  ) => Promise<SyncOsvEcosystemSummary>
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

function parseBootstrapEntryId(entryName: string) {
  const trimmed = entryName.trim()

  if (!trimmed.endsWith(".json") || trimmed.includes("/")) {
    return null
  }

  return trimmed.slice(0, -".json".length) || null
}

export function buildBootstrapArchiveEntriesListCommand(archivePath: string) {
  return ["unzip", "-Z1", archivePath]
}

export function buildBootstrapArchiveExtractCommand(
  archivePath: string,
  targetDirectory: string,
) {
  return ["unzip", "-oq", archivePath, "-d", targetDirectory]
}

async function defaultListArchiveEntries(archivePath: string) {
  const command = buildBootstrapArchiveEntriesListCommand(archivePath)
  const result = await execFile(command[0]!, command.slice(1), {
    maxBuffer: UNZIP_MAX_BUFFER_BYTES,
  })

  return String(result.stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

async function defaultExtractArchiveToDirectory(
  archivePath: string,
  targetDirectory: string,
) {
  await fs.rm(targetDirectory, { recursive: true, force: true })
  await fs.mkdir(targetDirectory, { recursive: true })

  const command = buildBootstrapArchiveExtractCommand(archivePath, targetDirectory)
  await execFile(command[0]!, command.slice(1), {
    maxBuffer: UNZIP_MAX_BUFFER_BYTES,
  })
}

async function defaultListExtractedEntries(targetDirectory: string) {
  const entries = await fs.readdir(targetDirectory, { withFileTypes: true })

  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
}

async function defaultReadExtractedEntryText(
  targetDirectory: string,
  entryName: string,
) {
  return fs.readFile(path.join(targetDirectory, entryName), "utf8")
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
        rawHash: sha256(rawText),
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

export async function bootstrapOsvEcosystem({
  db,
  ecosystem,
  repoRoot,
  limit,
  now = () => new Date(),
  fetchBytes,
  downloadArchiveToCache: downloadArchive = downloadOsvArchiveToCache,
  extractArchiveToDirectory = defaultExtractArchiveToDirectory,
  listExtractedEntries = defaultListExtractedEntries,
  readExtractedEntryText = defaultReadExtractedEntryText,
  deleteCachedFile = deleteCachedOsvFile,
  upsertNormalizedOsvRecord: upsertRecord = upsertNormalizedOsvRecord,
  upsertSecuritySyncState: upsertSyncState = upsertSecuritySyncState,
}: BootstrapOsvEcosystemInput): Promise<SyncOsvEcosystemSummary> {
  const syncedAt = now()
  const packageEcosystem = toSecurityPackageEcosystem(ecosystem)

  await upsertSyncState(db, packageEcosystem, {
    status: SecuritySyncStatus.RUNNING,
    now: syncedAt,
  })

  const archivePath = await downloadArchive({
    repoRoot,
    ecosystem,
    fileName: "all.zip",
    url: buildOsvBootstrapArchiveUrl(ecosystem),
    ...(fetchBytes ? { fetchBytes } : {}),
  })
  const extractedDirectory = buildOsvBootstrapPath({
    repoRoot,
    ecosystem,
    fileName: "all-extracted",
  })

  let recordsSeen = 0
  let recordsImported = 0
  let recordsFailed = 0
  let lastProcessedModifiedAt: Date | null = null

  try {
    await extractArchiveToDirectory(archivePath, extractedDirectory)
    const entryNames = await listExtractedEntries(extractedDirectory)
    const jsonEntries = entryNames
      .map((entryName) => ({
        entryName,
        externalId: parseBootstrapEntryId(entryName),
      }))
      .filter(
        (
          entry,
        ): entry is {
          entryName: string
          externalId: string
        } => Boolean(entry.externalId),
      )
      .slice(0, limit && limit > 0 ? limit : undefined)

    recordsSeen = jsonEntries.length

    for (const entry of jsonEntries) {
      try {
        const rawText = await readExtractedEntryText(
          extractedDirectory,
          entry.entryName,
        )
        const vulnerability = JSON.parse(rawText)
        const sourceUrl = buildOsvVulnerabilityUrl(ecosystem, entry.externalId)
        const normalized = normalizeOsvRecord(vulnerability, {
          sourceUrl,
          rawHash: sha256(rawText),
        })

        await upsertRecord(db, normalized)
        recordsImported += 1
        if (
          normalized.advisory.modifiedAt &&
          (!lastProcessedModifiedAt ||
            normalized.advisory.modifiedAt.getTime() >
              lastProcessedModifiedAt.getTime())
        ) {
          lastProcessedModifiedAt = normalized.advisory.modifiedAt
        }
      } catch {
        recordsFailed += 1
      }
    }
  } finally {
    await deleteCachedFile(archivePath)
    await deleteCachedFile(extractedDirectory)
  }

  await upsertSyncState(db, packageEcosystem, {
    status: recordsFailed > 0 ? SecuritySyncStatus.FAILED : SecuritySyncStatus.SUCCESS,
    now: syncedAt,
    lastProcessedModifiedAt,
    lastError:
      recordsFailed > 0 ? `${recordsFailed} OSV records failed to bootstrap.` : null,
    recordsSeen,
    recordsImported,
    recordsFailed,
  })

  return {
    ecosystem,
    recordsSeen,
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

export async function bootstrapAllOsvEcosystems({
  ecosystems = OSV_DUMP_ECOSYSTEMS,
  concurrency = 2,
  syncOne = bootstrapOsvEcosystem,
  ...input
}: BootstrapAllOsvEcosystemsInput) {
  const results = new Array<SyncOsvEcosystemSummary>(ecosystems.length)
  const maxConcurrency = Math.max(1, Math.floor(concurrency))
  let nextIndex = 0

  async function runOne() {
    while (nextIndex < ecosystems.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      const ecosystem = ecosystems[currentIndex]!

      results[currentIndex] = await syncOne({ ...input, ecosystem })
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(maxConcurrency, ecosystems.length) },
      () => runOne(),
    ),
  )

  return results
}
