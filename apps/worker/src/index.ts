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

type WorkerLoopOptions = {
  intervalMs?: number;
  logger?: Pick<typeof console, "log" | "error">;
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
  logger: Pick<typeof console, "log" | "error"> = console,
) {
  logger.log(
    `worker cycle complete: ${summary.succeeded.length}/${summary.activeFeedCount} feeds succeeded`,
  );

  if (summary.failed.length === 0) {
    return;
  }

  const message = `worker cycle errors: ${summary.failed
    .map((failure) => `${failure.feedId}: ${failure.error}`)
    .join("; ")}`;

  logger.error(message);
  throw new Error(message);
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
  while (!signal?.aborted) {
    try {
      const summary = await runCycle();
      assertSuccessfulWorkerCycle(summary, logger);
    } catch (error) {
      logger.error(error);
    }

    if (signal?.aborted) {
      break;
    }

    await wait(intervalMs);
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
