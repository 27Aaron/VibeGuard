import type { WorkerCycleSummary } from "worker";
import { normalizeUserFacingError } from "./errors";

export type WorkerRunDetail = {
  articleId: string;
  title: string;
  status: "succeeded" | "failed";
  error?: string;
};

function clampMessage(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function encodeDetails(details: WorkerRunDetail[]) {
  return JSON.stringify(
    details.slice(0, 5).map((detail) => ({
      articleId: detail.articleId,
      title: clampMessage(detail.title).slice(0, 80),
      status: detail.status,
      error: detail.error
        ? clampMessage(detail.error).slice(0, 120)
        : undefined,
    })),
  );
}

export function decodeWorkerRunDetails(serialized: string | undefined) {
  if (!serialized) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (detail): detail is WorkerRunDetail =>
        !!detail &&
        typeof detail.articleId === "string" &&
        typeof detail.title === "string" &&
        (detail.status === "succeeded" || detail.status === "failed"),
    );
  } catch {
    return [];
  }
}

export function buildWorkerRunRedirectParams(
  summary: WorkerCycleSummary,
  details: WorkerRunDetail[] = [],
) {
  const params = new URLSearchParams({
    run: summary.failed.length === 0 ? "success" : "warning",
    feeds: String(summary.activeFeedCount),
    succeeded: String(summary.succeeded.length),
    failed: String(summary.failed.length),
    jobs: String(summary.processedJobs.length),
  });

  if (details.length > 0) {
    params.set("details", encodeDetails(details));
  }

  if (summary.failed.length > 0) {
    params.set(
      "message",
      clampMessage(
        summary.failed
          .map(
            (failure) =>
              `${failure.feedId}: ${normalizeUserFacingError(new Error(failure.error))}`,
          )
          .join("; "),
      ),
    );
  }

  return params;
}

export function buildWorkerRunErrorParams(error: unknown) {
  const params = new URLSearchParams({
    run: "failed",
    message: clampMessage(normalizeUserFacingError(error)),
  });

  return params;
}
