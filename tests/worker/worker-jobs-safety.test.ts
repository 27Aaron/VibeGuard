import { afterEach, describe, expect, it, vi } from "vitest";

import { JobStatus, JobType } from "@vibeguard/shared";

// ---------------------------------------------------------------------------
// Test 1: resetStaleRunningJobs keeps control-requested jobs bounded
// ---------------------------------------------------------------------------

describe("resetStaleRunningJobs", () => {
  it("pauses stale pause requests, deletes stale cancel requests, and requeues stale running jobs", async () => {
    const pauseChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "paused-job" }]),
    };
    const runningChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "job-1" }, { id: "job-2" }]),
    };
    const staleFailedChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "job-3" }]),
    };
    const deleteChain = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "cancelled-job" }]),
    };

    const mockDb = {
      update: vi
        .fn()
        .mockReturnValueOnce(pauseChain)
        .mockReturnValueOnce(runningChain)
        .mockReturnValueOnce(staleFailedChain),
      delete: vi.fn().mockReturnValue(deleteChain),
    } as never;

    const { resetStaleRunningJobs } =
      await import("../../apps/worker/src/jobs");

    const result = await resetStaleRunningJobs(mockDb, {
      now: new Date("2026-05-20T12:00:00Z"),
      staleAfterMinutes: 3,
    });

    expect(mockDb.update).toHaveBeenCalledTimes(3);
    expect(mockDb.delete).toHaveBeenCalledTimes(1);

    expect(pauseChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.PAUSED,
      }),
    );
    expect(runningChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.QUEUED,
        pipelineStage: "waiting",
      }),
    );
    expect(staleFailedChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.FAILED,
      }),
    );

    expect(pauseChain.where).toHaveBeenCalledTimes(1);
    expect(runningChain.where).toHaveBeenCalledTimes(1);
    expect(staleFailedChain.where).toHaveBeenCalledTimes(1);
    expect(deleteChain.where).toHaveBeenCalledTimes(1);
    expect(result.resetCount).toBe(3);
    expect(result.failedCount).toBe(2);
  });

  it("returns zero counts when no stale jobs exist", async () => {
    const pauseChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    const runningChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    const staleFailedChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    const deleteChain = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };

    const mockDb = {
      update: vi
        .fn()
        .mockReturnValueOnce(pauseChain)
        .mockReturnValueOnce(runningChain)
        .mockReturnValueOnce(staleFailedChain),
      delete: vi.fn().mockReturnValue(deleteChain),
    } as never;

    const { resetStaleRunningJobs } =
      await import("../../apps/worker/src/jobs");

    const result = await resetStaleRunningJobs(mockDb, {
      now: new Date("2026-05-20T12:00:00Z"),
      staleAfterMinutes: 3,
    });

    expect(result.resetCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2: processClaimedJob catch block handles secondary failures gracefully
// ---------------------------------------------------------------------------

/**
 * Helper to build a mock db that simulates the processClaimedJob flow:
 *   1. claimQueuedJobById: findFirst + update...returning -> resolves claimed job
 *   2. processArticleJob: throws (controlled by vi.doMock)
 *   3. markArticleStatus: update...where -> controlled by thenable
 *   4. markJobFailed: update...where -> controlled by thenable
 *
 * In drizzle-orm, `db.update().set().where()` without `.returning()` returns
 * a thenable that resolves to `undefined`. We simulate this by making the
 * chain object itself thenable.
 */
function buildMockDb(options: {
  fakeJob: Record<string, unknown>;
  /** Index (1-based) of the update whose .where() should throw. */
  throwOnWhereIndex?: number;
  /** If true, all .where() calls succeed. */
  allSucceed?: boolean;
}) {
  let updateIndex = 0;

  // We use a real object so we can make it thenable
  const chain: Record<string, unknown> = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      updateIndex++;
      // If this is the claimQueuedJobById update, returning() follows.
      // For others, the chain is awaited directly.
      return chain;
    }),
    returning: vi.fn().mockImplementation(() => {
      // claimQueuedJobById always succeeds
      return Promise.resolve([options.fakeJob]);
    }),
  };

  // Make the chain thenable so `await db.update().set().where()` resolves
  // for markArticleStatus and markJobFailed.
  (chain as any).then = vi
    .fn()
    .mockImplementation(
      (resolve: (v: undefined) => void, reject: (e: Error) => void) => {
        if (!options.allSucceed && options.throwOnWhereIndex === updateIndex) {
          reject(new Error(`DB error on update #${updateIndex}`));
        } else {
          resolve(undefined);
        }
      },
    );

  const mockDb = {
    update: vi.fn().mockReturnValue(chain),
    query: {
      processingJobs: {
        findFirst: vi.fn().mockResolvedValue(options.fakeJob),
      },
      articles: {
        findFirst: vi.fn().mockResolvedValue({
          id: options.fakeJob.articleId,
          rawMeta: null,
        }),
      },
      llmSettings: {
        findFirst: vi.fn().mockResolvedValue({ apiKeyEncrypted: "key" }),
      },
    },
  };

  return { mockDb: mockDb as never, getUpdateIndex: () => updateIndex };
}

describe("processClaimedJob catch block", () => {
  const fakeJob = {
    id: "job-1",
    articleId: "article-1",
    jobType: JobType.EXTRACT,
    status: JobStatus.RUNNING,
    attempt: 1,
    maxAttempts: 3,
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns the original error even when markArticleStatus and markJobFailed both throw", async () => {
    // Both markArticleStatus (update #2) and markJobFailed (update #3) throw
    const { mockDb } = buildMockDb({
      fakeJob,
      throwOnWhereIndex: 2, // markArticleStatus throws; markJobFailed also throws because then() rejects for 3 too
    });

    // Make processArticleJob throw
    vi.doMock("../../apps/worker/src/article-pipeline", () => ({
      JobPausedSignal: class JobPausedSignal extends Error {},
      JobCancelledSignal: class JobCancelledSignal extends Error {},
      processArticleJob: vi
        .fn()
        .mockRejectedValue(new Error("LLM processing failed")),
    }));
    vi.resetModules();

    const { processQueuedJobById } =
      await import("../../apps/worker/src/process-article");

    const result = await processQueuedJobById(mockDb, "job-1");

    // The function must return a failed result with the ORIGINAL error message
    // even though both secondary operations (markArticleStatus, markJobFailed) threw
    expect(result).not.toBeNull();
    expect(result!.status).toBe("failed");
    expect(result!.error).toBe("LLM processing failed");
    expect(result!.jobId).toBe("job-1");
    expect(result!.articleId).toBe("article-1");
  });

  it("still attempts markJobFailed even when markArticleStatus throws", async () => {
    // markArticleStatus (update #2) throws, markJobFailed (update #3) succeeds
    const { mockDb, getUpdateIndex } = buildMockDb({
      fakeJob,
      allSucceed: false,
      throwOnWhereIndex: 2,
    });

    vi.doMock("../../apps/worker/src/article-pipeline", () => ({
      JobPausedSignal: class JobPausedSignal extends Error {},
      JobCancelledSignal: class JobCancelledSignal extends Error {},
      processArticleJob: vi.fn().mockRejectedValue(new Error("pipeline crash")),
    }));
    vi.resetModules();

    const { processQueuedJobById } =
      await import("../../apps/worker/src/process-article");

    const result = await processQueuedJobById(mockDb, "job-2");

    // markJobFailed should still have been attempted.
    // We had 3 update calls: claim (#1), markArticleStatus (#2), markJobFailed (#3).
    expect(getUpdateIndex()).toBeGreaterThanOrEqual(3);
    expect(result!.status).toBe("failed");
    expect(result!.error).toBe("pipeline crash");
  });

  it("returns the original error when only markJobFailed throws", async () => {
    // markArticleStatus (#2) succeeds, markJobFailed (#3) throws
    const { mockDb } = buildMockDb({
      fakeJob,
      throwOnWhereIndex: 3,
    });

    vi.doMock("../../apps/worker/src/article-pipeline", () => ({
      JobPausedSignal: class JobPausedSignal extends Error {},
      JobCancelledSignal: class JobCancelledSignal extends Error {},
      processArticleJob: vi
        .fn()
        .mockRejectedValue(new Error("timeout exceeded")),
    }));
    vi.resetModules();

    const { processQueuedJobById } =
      await import("../../apps/worker/src/process-article");

    const result = await processQueuedJobById(mockDb, "job-3");

    expect(result).not.toBeNull();
    expect(result!.status).toBe("failed");
    expect(result!.error).toBe("timeout exceeded");
  });
});
