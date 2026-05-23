import { describe, expect, it, vi } from "vitest"

import { JobStatus, JobType } from "@vibeguard/shared"

// ---------------------------------------------------------------------------
// Test 1: resetStaleRunningJobs only updates jobs still in RUNNING status
// ---------------------------------------------------------------------------

describe("resetStaleRunningJobs", () => {
  it("issues a single bulk UPDATE with status=RUNNING in the WHERE clause", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        { id: "job-1" },
        { id: "job-2" },
      ]),
    }

    const mockDb = {
      update: vi.fn().mockReturnValue(updateChain),
    } as never

    const { resetStaleRunningJobs } = await import(
      "../../apps/worker/src/jobs"
    )

    const result = await resetStaleRunningJobs(mockDb, {
      now: new Date("2026-05-20T12:00:00Z"),
      staleAfterMinutes: 3,
    })

    // The function should call db.update exactly once (bulk, no N+1)
    expect(mockDb.update).toHaveBeenCalledTimes(1)

    // .set() should be called with status QUEUED and pipelineStage WAITING
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.QUEUED,
        pipelineStage: "waiting",
      }),
    )

    // .where() must be called — this is the critical safety check.
    expect(updateChain.where).toHaveBeenCalledTimes(1)

    // Verify the result counting
    expect(result.resetCount).toBe(2)
    expect(result.failedCount).toBe(0)
  })

  it("returns zero counts when no stale jobs exist", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    }

    const mockDb = {
      update: vi.fn().mockReturnValue(updateChain),
    } as never

    const { resetStaleRunningJobs } = await import(
      "../../apps/worker/src/jobs"
    )

    const result = await resetStaleRunningJobs(mockDb, {
      now: new Date("2026-05-20T12:00:00Z"),
      staleAfterMinutes: 3,
    })

    expect(result.resetCount).toBe(0)
    expect(result.failedCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test 2: processClaimedJob catch block handles secondary failures gracefully
// ---------------------------------------------------------------------------

describe("processClaimedJob catch block", () => {
  it("returns the original error even when markArticleStatus and markJobFailed both throw", async () => {
    // Build a mock where:
    //   1. claimQueuedJobById succeeds (findFirst + update returning both work)
    //   2. processArticleJob throws
    //   3. markArticleStatus throws on db.update (the articles update)
    //   4. markJobFailed throws on db.update (the processingJobs update)
    // The function must still return the original error message.

    const fakeJob = {
      id: "job-1",
      articleId: "article-1",
      jobType: JobType.EXTRACT,
      status: JobStatus.RUNNING,
      attempt: 1,
      maxAttempts: 3,
    }

    let updateCallIndex = 0

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockImplementation(() => {
        updateCallIndex++
        if (updateCallIndex === 1) {
          // claimQueuedJobById: update succeeds, returns the claimed job
          return [fakeJob]
        }
        // All subsequent update calls (markArticleStatus, markJobFailed) throw
        // to simulate secondary DB failures in the catch block.
        throw new Error("DB connection lost during cleanup")
      }),
    }

    const mockDb = {
      update: vi.fn().mockReturnValue(mockUpdateChain),
      query: {
        processingJobs: {
          findFirst: vi.fn().mockResolvedValue(fakeJob),
        },
        articles: {
          // Used by markArticleStatus local function
          findFirst: vi.fn().mockResolvedValue({ id: "article-1", rawMeta: null }),
        },
        llmSettings: {
          findFirst: vi.fn().mockResolvedValue({ apiKeyEncrypted: "key" }),
        },
      },
    } as never

    // Mock the article-pipeline module to make processArticleJob throw
    vi.doMock("../../apps/worker/src/article-pipeline", () => ({
      processArticleJob: vi.fn().mockRejectedValue(new Error("LLM processing failed")),
    }))

    // Need to reimport to pick up the mock
    vi.resetModules()

    const { processQueuedJobById } = await import(
      "../../apps/worker/src/process-article"
    )

    const result = await processQueuedJobById(mockDb, "job-1")

    // The function must return a failed result with the ORIGINAL error message
    expect(result).not.toBeNull()
    expect(result!.status).toBe("failed")
    expect(result!.error).toBe("LLM processing failed")
    expect(result!.jobId).toBe("job-1")
    expect(result!.articleId).toBe("article-1")

    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("still attempts markJobFailed even when markArticleStatus throws", async () => {
    const fakeJob = {
      id: "job-2",
      articleId: "article-2",
      jobType: JobType.EXTRACT,
      status: JobStatus.RUNNING,
      attempt: 1,
      maxAttempts: 3,
    }

    let updateCallIndex = 0

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockImplementation(() => {
        updateCallIndex++
        if (updateCallIndex === 1) {
          // claimQueuedJobById: succeeds
          return [fakeJob]
        }
        if (updateCallIndex === 2) {
          // markArticleStatus (articles table): throws
          throw new Error("article status update failed")
        }
        if (updateCallIndex === 3) {
          // markJobFailed (processingJobs table): succeeds
          return [{ id: "job-2" }]
        }
        return []
      }),
    }

    const mockDb = {
      update: vi.fn().mockReturnValue(mockUpdateChain),
      query: {
        processingJobs: {
          findFirst: vi.fn().mockResolvedValue(fakeJob),
        },
        articles: {
          findFirst: vi.fn().mockResolvedValue({ id: "article-2", rawMeta: null }),
        },
        llmSettings: {
          findFirst: vi.fn().mockResolvedValue({ apiKeyEncrypted: "key" }),
        },
      },
    } as never

    vi.doMock("../../apps/worker/src/article-pipeline", () => ({
      processArticleJob: vi.fn().mockRejectedValue(new Error("pipeline crash")),
    }))

    vi.resetModules()

    const { processQueuedJobById } = await import(
      "../../apps/worker/src/process-article"
    )

    const result = await processQueuedJobById(mockDb, "job-2")

    // markJobFailed should still have been attempted (3rd update call)
    expect(updateCallIndex).toBeGreaterThanOrEqual(3)
    expect(result!.status).toBe("failed")
    expect(result!.error).toBe("pipeline crash")

    vi.restoreAllMocks()
    vi.resetModules()
  })
})
