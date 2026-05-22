import { pathToFileURL } from "node:url";

import { closeDb, getDb } from "@vibeguard/db";

import { pollActiveFeeds } from "./poll-feeds";
import { processAvailableQueuedJobs } from "./process-article";

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

function computeIdleInterval(baseIntervalMs: number, consecutiveIdleCycles: number) {
  if (consecutiveIdleCycles <= 0) {
    return baseIntervalMs
  }

  const maxIntervalMs = resolveInt(
    process.env.WORKER_MAX_IDLE_INTERVAL_MS,
    DEFAULT_IDLE_MAX_INTERVAL_MS,
  )
  const backoffFactor = 2 ** Math.min(consecutiveIdleCycles, 6)
  return Math.min(baseIntervalMs * backoffFactor, maxIntervalMs)
}

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export async function runWorkerLoop({
  intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? "5000"),
  logger = console,
  runCycle = runWorkerCycle,
  signal,
  sleep: wait = sleep,
}: WorkerLoopOptions = {}) {
  let consecutiveIdleCycles = 0
  let currentInterval = intervalMs

  while (!signal?.aborted) {
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
      ? intervalMs
      : computeIdleInterval(intervalMs, consecutiveIdleCycles)

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
    await runWorkerLoop({ signal: controller.signal });
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await closeDb();
  }
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
