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
  upsertNormalizedOsvRecordsBatch,
  upsertSecuritySyncState,
  type SecuritySyncStateUpdateInput,
} from "./store"
import { normalizeInt } from "../shared/normalize"

type ContentDb = NodePgDatabase<typeof schema>

type FetchText = (url: string, maxBytes?: number) => Promise<string>
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
const DEFAULT_BOOTSTRAP_BATCH_SIZE = 200
const DEFAULT_MODIFIED_ID_ROW_LIMIT = 2000
const DEFAULT_VULNERABILITY_TEXT_BYTES = 2 * 1024 * 1024

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
  batchSize?: number
  now?: () => Date
  fetchBytes?: FetchBytes
  downloadArchiveToCache?: typeof downloadOsvArchiveToCache
  iterateArchiveEntries?: (
    archivePath: string,
  ) => Promise<AsyncIterable<BootstrapArchiveEntry>> | AsyncIterable<BootstrapArchiveEntry>
  deleteCachedFile?: typeof deleteCachedOsvFile
  upsertNormalizedOsvRecord?: typeof upsertNormalizedOsvRecord
  upsertNormalizedOsvRecordsBatch?: typeof upsertNormalizedOsvRecordsBatch
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
  recordsNew: number
  recordsChanged: number
  recordsSkipped: number
  recordsFailed: number
  lastProcessedModifiedAt: Date | null
}

export type ModifiedIdRow = {
  modifiedAt: Date
  externalId: string
}

const MAX_MODIFIED_ID_ROW_LIMIT = normalizeInt(
  process.env.VIBEGUARD_OSV_MODIFIED_ID_ROW_LIMIT,
  DEFAULT_MODIFIED_ID_ROW_LIMIT,
)

const MAX_VULNERABILITY_TEXT_BYTES = normalizeInt(
  process.env.VIBEGUARD_OSV_VULNERABILITY_TEXT_BYTES,
  DEFAULT_VULNERABILITY_TEXT_BYTES,
)

type BootstrapArchiveEntry = {
  entryName: string
  readText: () => Promise<string>
}

function parseOsvTimestamp(value: string) {
  const normalized = value.replace(
    /\.(\d{3})\d*Z$/,
    (_match, millis: string) => `.${millis}Z`,
  )
  const parsed = new Date(normalized)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function assertSafeArchivePath(archivePath: string) {
  const normalized = path.resolve(archivePath)

  if (normalized.includes("\u0000")) {
    throw new Error(`Invalid OSV archive path: ${archivePath}`)
  }

  return normalized
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

async function readResponseText(
  response: Response,
  url: string,
  maxBytes: number,
) {
  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  )

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(
      `Response body for ${url} is too large (${contentLength} bytes, max ${maxBytes})`,
    )
  }

  if (!response.body) {
    const text = await response.text()

    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error(
        `Response body for ${url} is too large (${Buffer.byteLength(text, "utf8")} bytes, max ${maxBytes})`,
      )
    }

    return text
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    total += value.byteLength

    if (total > maxBytes) {
      await reader.cancel()
      throw new Error(
        `Response body for ${url} is too large (${total} bytes, max ${maxBytes})`,
      )
    }

    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks, total).toString("utf8")
}

async function defaultFetchText(url: string, maxBytes = MAX_VULNERABILITY_TEXT_BYTES) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download OSV file: ${response.status} ${url}`)
  }

  return readResponseText(response, url, maxBytes)
}

export function buildModifiedIdCsvUrl(ecosystem: OsvDumpEcosystem) {
  return `${OSV_VULNERABILITIES_BASE_URL}/${encodeURIComponent(
    ecosystem,
  )}/modified_id.csv`
}

export function parseModifiedIdCsv(
  csv: string,
  limit?: number,
): ModifiedIdRow[] {
  const maxRows = Math.max(0, limit ?? Number.POSITIVE_INFINITY)
  const rows: ModifiedIdRow[] = []
  const effectiveLimit = Number.isFinite(maxRows) ? Math.floor(maxRows) : Infinity

  if (effectiveLimit <= 0) {
    return rows
  }

  let lineStart = 0
  for (let index = 0; index <= csv.length; index += 1) {
    if (index < csv.length && csv[index] !== "\n") {
      continue
    }

    const rawLine = csv.slice(lineStart, index).trimEnd()
    lineStart = index + 1

    if (!rawLine) {
      continue
    }

    const line = rawLine.replace(/\r$/, "")
    const [timestamp, externalId] = line.split(",")
    const modifiedAt = timestamp ? parseOsvTimestamp(timestamp.trim()) : null
    const trimmedId = externalId?.trim()

    if (!modifiedAt || !trimmedId) {
      continue
    }

    rows.push({ modifiedAt, externalId: trimmedId })

    if (rows.length >= effectiveLimit) {
      break
    }
  }

  return rows
}

function ensureTextSizeLimit(text: string, label: string, maxBytes: number) {
  const byteLength = Buffer.byteLength(text, "utf8")

  if (byteLength > maxBytes) {
    throw new Error(`${label} payload too large (${byteLength} bytes, max ${maxBytes})`)
  }
}

async function readLimitedStreamText(
  stream: NodeJS.ReadableStream,
  maxBytes: number,
) {
  let total = 0
  const chunks: Buffer[] = []

  for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
    const chunkBytes = Buffer.from(chunk).byteLength
    total += chunkBytes

    if (total > maxBytes) {
      throw new Error(`OSV archive entry payload too large (${total} bytes, max ${maxBytes})`)
    }

    chunks.push(Buffer.from(chunk))
  }

  return Buffer.concat(chunks, total).toString("utf8")
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

async function* defaultIterateArchiveEntries(
  archivePath: string,
): AsyncGenerator<BootstrapArchiveEntry> {
  // yauzl-promise does not currently ship TypeScript declarations.
  // @ts-expect-error third-party package has no bundled types
  const yauzl = await import("yauzl-promise")
  const zip = await yauzl.open(archivePath)

  try {
    for await (const entry of zip as AsyncIterable<{
      filename: string
      openReadStream: () => Promise<NodeJS.ReadableStream>
    }>) {
      yield {
        entryName: entry.filename,
        readText: async () =>
          readLimitedStreamText(
            await entry.openReadStream(),
            MAX_VULNERABILITY_TEXT_BYTES,
          ),
      }
    }
  } finally {
    await zip.close()
  }
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

  const modifiedCsv = await fetchText(
    buildModifiedIdCsvUrl(ecosystem),
    MAX_VULNERABILITY_TEXT_BYTES,
  )
  const effectiveLimit = Math.min(
    Math.max(0, limit ?? Number.POSITIVE_INFINITY),
    MAX_MODIFIED_ID_ROW_LIMIT,
  )
  const rows = parseModifiedIdCsv(modifiedCsv, Math.max(0, effectiveLimit))
  const fetchTextForVulnerability = (url: string) =>
    fetchText(url, MAX_VULNERABILITY_TEXT_BYTES)
  let recordsImported = 0
  let recordsNew = 0
  let recordsChanged = 0
  let recordsSkipped = 0
  let recordsFailed = 0
  let lastProcessedModifiedAt: Date | null = null

  for (const row of rows) {
    const sourceUrl = buildOsvVulnerabilityUrl(ecosystem, row.externalId)
    const filePath = await downloadOsvTextToCache({
      repoRoot,
      ecosystem,
      fileName: `${row.externalId}.json`,
      url: sourceUrl,
      fetchText: fetchTextForVulnerability,
    })

    try {
      const rawText = await fs.readFile(filePath, "utf8")
      ensureTextSizeLimit(
        rawText,
        `OSV advisory ${row.externalId}`,
        MAX_VULNERABILITY_TEXT_BYTES,
      )
      const vulnerability = JSON.parse(rawText)
      const normalized = normalizeOsvRecord(vulnerability, {
        sourceUrl,
        rawHash: sha256(rawText),
      })

      const result = await upsertRecord(db, normalized)
      await deleteCachedOsvFile(filePath)
      recordsImported += result.skipped ? 0 : 1
      recordsNew += result.writeKind === "new" ? 1 : 0
      recordsChanged += result.writeKind === "changed" ? 1 : 0
      recordsSkipped += result.skipped ? 1 : 0
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
    recordsNew,
    recordsChanged,
    recordsSkipped,
    recordsFailed,
    lastProcessedModifiedAt,
  }
}

export async function bootstrapOsvEcosystem({
  db,
  ecosystem,
  repoRoot,
  limit,
  batchSize = DEFAULT_BOOTSTRAP_BATCH_SIZE,
  now = () => new Date(),
  fetchBytes,
  downloadArchiveToCache: downloadArchive = downloadOsvArchiveToCache,
  iterateArchiveEntries = defaultIterateArchiveEntries,
  deleteCachedFile = deleteCachedOsvFile,
  upsertNormalizedOsvRecord: upsertRecord = upsertNormalizedOsvRecord,
  upsertNormalizedOsvRecordsBatch: upsertRecordsBatch = upsertNormalizedOsvRecordsBatch,
  upsertSecuritySyncState: upsertSyncState = upsertSecuritySyncState,
}: BootstrapOsvEcosystemInput): Promise<SyncOsvEcosystemSummary> {
  const syncedAt = now()
  const packageEcosystem = toSecurityPackageEcosystem(ecosystem)

  await upsertSyncState(db, packageEcosystem, {
    status: SecuritySyncStatus.RUNNING,
    now: syncedAt,
  })

  const archivePath = assertSafeArchivePath(
    await downloadArchive({
      repoRoot,
      ecosystem,
      fileName: "all.zip",
      url: buildOsvBootstrapArchiveUrl(ecosystem),
      ...(fetchBytes ? { fetchBytes } : {}),
    }),
  )

  let recordsSeen = 0
  let recordsImported = 0
  let recordsNew = 0
  let recordsChanged = 0
  let recordsSkipped = 0
  let recordsFailed = 0
  let lastProcessedModifiedAt: Date | null = null
  let pendingRecords = [] as Array<ReturnType<typeof normalizeOsvRecord>>
  const effectiveBatchSize = Math.max(1, Math.floor(batchSize))

  async function flushPendingRecords() {
    if (pendingRecords.length === 0) {
      return
    }

    const batch = pendingRecords
    pendingRecords = []

    try {
      const result = await upsertRecordsBatch(db, batch)
      recordsImported += result.importedCount
      recordsNew += result.newCount
      recordsChanged += result.changedCount
      recordsSkipped += result.skippedCount
      return
    } catch {
      for (const record of batch) {
        try {
          const result = await upsertRecord(db, record)
          recordsImported += result.skipped ? 0 : 1
          recordsNew += result.writeKind === "new" ? 1 : 0
          recordsChanged += result.writeKind === "changed" ? 1 : 0
          recordsSkipped += result.skipped ? 1 : 0
        } catch {
          recordsFailed += 1
        }
      }
    }
  }

  try {
    for await (const entry of await iterateArchiveEntries(archivePath)) {
      const externalId = parseBootstrapEntryId(entry.entryName)

      if (!externalId) {
        continue
      }

      if (limit && limit > 0 && recordsSeen >= limit) {
        break
      }

      recordsSeen += 1

      try {
        const rawText = await entry.readText()
        ensureTextSizeLimit(
          rawText,
          `OSV archive entry ${externalId}`,
          MAX_VULNERABILITY_TEXT_BYTES,
        )
        const vulnerability = JSON.parse(rawText)
        const sourceUrl = buildOsvVulnerabilityUrl(ecosystem, externalId)
        const normalized = normalizeOsvRecord(vulnerability, {
          sourceUrl,
          rawHash: sha256(rawText),
        })

        pendingRecords.push(normalized)
        if (
          normalized.advisory.modifiedAt &&
          (!lastProcessedModifiedAt ||
            normalized.advisory.modifiedAt.getTime() >
              lastProcessedModifiedAt.getTime())
        ) {
          lastProcessedModifiedAt = normalized.advisory.modifiedAt
        }
        if (pendingRecords.length >= effectiveBatchSize) {
          await flushPendingRecords()
        }
      } catch {
        recordsFailed += 1
      }
    }

    await flushPendingRecords()
  } finally {
    await deleteCachedFile(archivePath)
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
    recordsNew,
    recordsChanged,
    recordsSkipped,
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
