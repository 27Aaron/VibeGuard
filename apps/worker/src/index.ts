import { pathToFileURL } from "node:url";

import { closeDb, getDb } from "@content-foundation/db";

import { pollActiveFeeds } from "./poll-feeds";
import { processQueuedJobs } from "./process-article";

export { pollFeedNow } from "./poll-feeds";
export { processQueuedJobs, processQueuedJobsByIds } from "./process-article";

export type WorkerCycleSummary = Awaited<ReturnType<typeof runWorkerCycle>>;

export async function runWorkerCycle() {
  const pollSummary = await pollActiveFeeds();
  const processedJobs = await processQueuedJobs(getDb());

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

export async function main() {
  try {
    const summary = await runWorkerCycle();
    assertSuccessfulWorkerCycle(summary);
  } finally {
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
