import { and, eq } from "drizzle-orm";

import { upsertSecuritySyncState } from "@vibeguard/content/osv/store";
import { closeDb, getDb, securitySyncState } from "@vibeguard/db";
import { SecuritySyncStatus } from "@vibeguard/shared";

import { pollActiveFeeds } from "./poll-feeds";
import { processAvailableQueuedJobs } from "./process-article";
import { isDirectExecution } from "./run-utils";

export { pollActiveFeeds, pollFeedNow } from "./poll-feeds";
export {
  processAllRemainingJobs,
  processAvailableQueuedJobs,
  processQueuedJobs,
  processQueuedJobsByIds,
} from "./process-article";

export type WorkerCycleSummary = Awaited<ReturnType<typeof runWorkerCycle>>;

type WorkerLogger = Pick<typeof console, "log" | "error"> &
  Partial<Pick<typeof console, "warn">>;
type ContentDb = ReturnType<typeof getDb>;

type WorkerLoopOptions = {
  intervalMs?: number;
  logger?: WorkerLogger;
  runCycle?: typeof runWorkerCycle;
  signal?: AbortSignal;
  sleep?: (durationMs: number) => Promise<void>;
};

export async function runWorkerCycle() {
  const pollSummary = await pollActiveFeeds();
  const processedJobs = await processAvailableQueuedJobs(getDb());

  return {
    ...pollSummary,
    processedJobs,
  };
}

export function assertSuccessfulWorkerCycle(
  summary: WorkerCycleSummary,
  logger: WorkerLogger = console,
) {
  logger.log(
    `worker cycle complete: ${summary.succeeded.length}/${summary.activeFeedCount} feeds succeeded`,
  );

  if (summary.failed.length === 0) {
    return;
  }

  const message = `worker cycle warnings: ${summary.failed
    .map((failure) => `${failure.feedId}: ${failure.error}`)
    .join("; ")}`;

  if (typeof logger.warn === "function") {
    logger.warn(message);
    return;
  }

  logger.log(message);
}

function resolveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

const DEFAULT_IDLE_MAX_INTERVAL_MS = 60_000
const DEFAULT_POLL_INTERVAL_MS = 5_000
const MIN_POLL_INTERVAL_MS = 250

const MAX_BACKOFF_POWER = 6

function computeIdleInterval(baseIntervalMs: number, consecutiveIdleCycles: number) {
  if (consecutiveIdleCycles <= 0) {
    return baseIntervalMs
  }

  const maxIntervalMs = resolveInt(
    process.env.WORKER_MAX_IDLE_INTERVAL_MS,
    DEFAULT_IDLE_MAX_INTERVAL_MS,
  )
  const backoffFactor = 2 ** Math.min(consecutiveIdleCycles, MAX_BACKOFF_POWER)
  return Math.min(baseIntervalMs * backoffFactor, maxIntervalMs)
}

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

// --- OSV Sync Scheduler ---

const DEFAULT_OSV_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000

function resolveOsvSyncInterval(env = process.env) {
  const configured = env.OSV_SYNC_INTERVAL_MS?.trim()
  if (!configured) return DEFAULT_OSV_SYNC_INTERVAL_MS

  const parsed = Number.parseInt(configured, 10)
  if (!Number.isFinite(parsed) || parsed < 60_000) return DEFAULT_OSV_SYNC_INTERVAL_MS

  return parsed
}

export async function hasSuccessfulSyncMarker(
  db: ContentDb,
  source: string,
  scope = "full",
) {
  const row = await db.query.securitySyncState.findFirst({
    where: and(
      eq(securitySyncState.source, source),
      eq(securitySyncState.scope, scope),
    ),
  })

  return row?.status === SecuritySyncStatus.SUCCESS
}

function summarizeOsvSyncResults(
  results: Array<{
    ecosystem: string
    recordsSeen: number
    recordsImported: number
    recordsFailed: number
  }>,
) {
  return results.reduce(
    (summary, result) => ({
      scopes: [...summary.scopes, result.ecosystem],
      recordsSeen: summary.recordsSeen + result.recordsSeen,
      recordsImported: summary.recordsImported + result.recordsImported,
      recordsFailed: summary.recordsFailed + result.recordsFailed,
    }),
    {
      scopes: [] as string[],
      recordsSeen: 0,
      recordsImported: 0,
      recordsFailed: 0,
    },
  )
}

async function markOsvFullSyncMarker(
  db: ContentDb,
  results: Array<{
    ecosystem: string
    recordsSeen: number
    recordsImported: number
    recordsFailed: number
  }>,
) {
  const summary = summarizeOsvSyncResults(results)
  const now = new Date()

  await upsertSecuritySyncState(db, "full", {
    source: "osv",
    status:
      summary.recordsFailed > 0
        ? SecuritySyncStatus.FAILED
        : SecuritySyncStatus.SUCCESS,
    now,
    cursorJson: {
      mode: "bootstrap",
      ecosystems: summary.scopes,
      completedAt: now.toISOString(),
    },
    lastError:
      summary.recordsFailed > 0
        ? `${summary.recordsFailed} OSV bootstrap records failed to sync.`
        : null,
    recordsSeen: summary.recordsSeen,
    recordsImported: summary.recordsImported,
    recordsFailed: summary.recordsFailed,
  })
}

export async function runOsvSyncCycle(logger: WorkerLogger = console) {
  try {
    const db = getDb()
    const shouldBootstrapOsv = !(await hasSuccessfulSyncMarker(db, "osv", "full"))
    const shouldBootstrapNvd = !(await hasSuccessfulSyncMarker(db, "nvd", "full"))
    const { bootstrapAllOsvEcosystems, syncAllOsvEcosystems } =
      await import("@vibeguard/content/osv/sync")
    const { syncAllSecurityEnrichmentSources } =
      await import("@vibeguard/content/security/enrichment")
    const results = shouldBootstrapOsv
      ? await bootstrapAllOsvEcosystems({ db, concurrency: 2 })
      : await syncAllOsvEcosystems({ db })
    for (const result of results) {
      logger.log(
        `osv ${shouldBootstrapOsv ? "bootstrap" : "sync"} ${result.ecosystem}: imported=${result.recordsImported} new=${result.recordsNew} changed=${result.recordsChanged} failed=${result.recordsFailed}`,
      )
    }
    if (shouldBootstrapOsv) {
      await markOsvFullSyncMarker(db, results)
    }
    const enrichmentResults = await syncAllSecurityEnrichmentSources(db, {
      mode: shouldBootstrapNvd ? "bootstrap" : "incremental",
    })
    for (const result of enrichmentResults) {
      logger.log(
        `security enrichment sync ${result.source}/${result.scope}: imported=${result.recordsImported} failed=${result.recordsFailed}`,
      )
    }
    return results
  } catch (error) {
    logger.error("osv sync failed:", error)
    return null
  }
}

export async function startOsvSyncScheduler(
  signal: AbortSignal,
  logger: WorkerLogger = console,
) {
  const intervalMs = resolveOsvSyncInterval()

  await runOsvSyncCycle(logger)

  while (!signal.aborted) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, intervalMs)
      const onAbort = () => {
        clearTimeout(timer)
        resolve()
      }
      signal.addEventListener("abort", onAbort, { once: true })
    })

    if (signal.aborted) break

    await runOsvSyncCycle(logger)
  }
}

// --- Worker Loop ---

function resolvePollInterval(value: number, fallback: number) {
  // Skip String→parseInt round-trip when already a number (I04)
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number.parseInt(String(value), 10)

  if (!Number.isFinite(parsed) || parsed < MIN_POLL_INTERVAL_MS) {
    return fallback
  }

  return parsed
}

const DEFAULT_MAX_ITERATIONS = 1000

export async function runWorkerLoop({
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  logger = console,
  runCycle = runWorkerCycle,
  signal,
  sleep: wait = sleep,
  maxIterations = DEFAULT_MAX_ITERATIONS,
}: WorkerLoopOptions & { maxIterations?: number } = {}) {
  const configuredIntervalMs = resolvePollInterval(intervalMs, DEFAULT_POLL_INTERVAL_MS)
  const envInterval = process.env.WORKER_POLL_INTERVAL_MS
  const baseIntervalMs = resolvePollInterval(
    envInterval === undefined ? configuredIntervalMs : Number(envInterval),
    configuredIntervalMs,
  )
  let consecutiveIdleCycles = 0
  let currentInterval = baseIntervalMs
  let iterations = 0

  while (!signal?.aborted) {
    if (iterations >= maxIterations) {
      logger.error(
        `Worker loop reached max iteration limit (${maxIterations}). Shutting down to prevent infinite loop without a signal.`,
      )
      break
    }

    iterations += 1
    let didPerformWork = false

    try {
      const summary = await runCycle();
      assertSuccessfulWorkerCycle(summary, logger);

      didPerformWork =
        summary.activeFeedCount > 0 || summary.processedJobs.length > 0
      if (didPerformWork) {
        consecutiveIdleCycles = 0
      } else {
        consecutiveIdleCycles += 1
      }
    } catch (error) {
      logger.error(error);
      consecutiveIdleCycles += 1
      didPerformWork = false
    }

    currentInterval = didPerformWork
      ? baseIntervalMs
      : computeIdleInterval(baseIntervalMs, consecutiveIdleCycles)

    if (signal?.aborted) {
      break;
    }

    await wait(currentInterval);
  }
}

export async function main() {
  const controller = new AbortController();
  const stop = () => controller.abort();

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await Promise.all([
      runWorkerLoop({ signal: controller.signal }),
      startOsvSyncScheduler(controller.signal),
    ]);
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await closeDb();
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
