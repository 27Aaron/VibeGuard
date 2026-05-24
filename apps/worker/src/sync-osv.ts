import { closeDb, getDb } from "@vibeguard/db"
import {
  bootstrapAllOsvEcosystems,
  type SyncOsvEcosystemSummary,
  syncAllOsvEcosystems,
} from "@vibeguard/content/osv/sync"
import {
  syncAllSecurityEnrichmentSources,
  type SecurityEnrichmentSyncSummary,
} from "@vibeguard/content/security/enrichment"

import { isDirectExecution } from "./run-utils"

export type OsvSyncMode = "bootstrap" | "incremental"

function parseExplicitLimit(argv: string[]) {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="))

  if (!limitArg) {
    return undefined
  }

  const parsed = Number.parseInt(limitArg.slice("--limit=".length), 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--limit must be a positive integer")
  }

  return parsed
}

function parseConcurrency(argv: string[]) {
  const concurrencyArg = argv.find((arg) => arg.startsWith("--concurrency="))

  if (!concurrencyArg) {
    return 2
  }

  const parsed = Number.parseInt(
    concurrencyArg.slice("--concurrency=".length),
    10,
  )

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--concurrency must be a positive integer")
  }

  return parsed
}

function parseMode(argv: string[]): OsvSyncMode {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="))

  if (!modeArg) {
    return "incremental"
  }

  const mode = modeArg.slice("--mode=".length).trim()

  if (mode === "bootstrap" || mode === "incremental") {
    return mode
  }

  throw new Error("--mode must be bootstrap or incremental")
}

export function parseArgs(argv: string[]) {
  const mode = parseMode(argv)
  const explicitLimit = parseExplicitLimit(argv)

  return {
    mode,
    limit: explicitLimit ?? (mode === "incremental" ? 20 : undefined),
    concurrency: parseConcurrency(argv),
  }
}

export function formatSyncSummaryLine(
  mode: OsvSyncMode,
  result: SyncOsvEcosystemSummary,
) {
  return [
    `osv ${mode} ${result.ecosystem}`,
    `seen=${result.recordsSeen}`,
    `imported=${result.recordsImported}`,
    `new=${result.recordsNew}`,
    `changed=${result.recordsChanged}`,
    `skipped=${result.recordsSkipped}`,
    `failed=${result.recordsFailed}`,
  ].join(" ")
}

export function formatEnrichmentSyncSummaryLine(result: SecurityEnrichmentSyncSummary) {
  return [
    `security enrichment ${result.source}/${result.scope}`,
    `seen=${result.recordsSeen}`,
    `imported=${result.recordsImported}`,
    `failed=${result.recordsFailed}`,
  ].join(" ")
}

export function getEnrichmentSyncMode(mode: OsvSyncMode) {
  return mode === "bootstrap" ? "bootstrap" : "incremental"
}

export async function main(argv = process.argv.slice(2)) {
  const { mode, limit, concurrency } = parseArgs(argv)

  try {
    const results =
      mode === "bootstrap"
        ? await bootstrapAllOsvEcosystems({
            db: getDb(),
            limit,
            concurrency,
          })
        : await syncAllOsvEcosystems({
            db: getDb(),
            limit,
          })

    for (const result of results) {
      console.log(formatSyncSummaryLine(mode, result))
    }

    const enrichmentResults = await syncAllSecurityEnrichmentSources(getDb(), {
      mode: getEnrichmentSyncMode(mode),
    })
    for (const result of enrichmentResults) {
      console.log(formatEnrichmentSyncSummaryLine(result))
    }
  } finally {
    await closeDb()
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
