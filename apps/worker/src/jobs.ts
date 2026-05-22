import { and, eq, sql } from "drizzle-orm";

import { processingJobs, schema } from "@vibeguard/db";
import { JobPipelineStage, JobStatus, JobType } from "@vibeguard/shared";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

type ContentDb = NodePgDatabase<typeof schema>;
const CLAIM_RETRY_MAX_ATTEMPTS = 6;
const CLAIM_RETRY_BASE_DELAY_MS = 25;
const CLAIM_RETRY_MAX_DELAY_MS = 250;

function waitMs(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export type BuildExtractJobInsertInput = {
  articleId: string;
  runAfter?: Date;
  maxAttempts?: number;
};

export function buildExtractJobInsert({
  articleId,
  runAfter = new Date(),
  maxAttempts = 3,
}: BuildExtractJobInsertInput) {
  return {
    articleId,
    jobType: JobType.EXTRACT,
    status: JobStatus.QUEUED,
    pipelineStage: JobPipelineStage.WAITING,
    attempt: 0,
    maxAttempts,
    runAfter,
  };
}

export async function enqueueExtractJob(
  db: ContentDb,
  articleId: string,
  options?: Omit<BuildExtractJobInsertInput, "articleId">,
) {
  const job = buildExtractJobInsert({
    articleId,
    ...options,
  });
  const inserted = await db
    .insert(processingJobs)
    .values(job)
    .onConflictDoNothing()
    .returning();

  return inserted[0] ?? null;
}

export function buildJobFailureUpdate(input: {
  attempt: number;
  maxAttempts: number;
  now?: Date;
  error: string;
}) {
  const now = input.now ?? new Date();
  const shouldRetry = input.attempt < input.maxAttempts;

  if (!shouldRetry) {
    return {
      status: JobStatus.FAILED,
      lastError: input.error,
      finishedAt: now,
      runAfter: now,
    };
  }

  const backoffMinutes = Math.min(input.attempt * 5, 30);

  return {
    status: JobStatus.QUEUED,
    lastError: input.error,
    finishedAt: now,
    runAfter: new Date(now.getTime() + backoffMinutes * 60 * 1000),
  };
}

export function buildStaleRunningJobUpdate(input: {
  attempt: number;
  maxAttempts: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const shouldRetry = input.attempt < input.maxAttempts;

  if (!shouldRetry) {
    return {
      status: JobStatus.FAILED,
      lastError: `任务执行超时，已达到 ${input.maxAttempts} 次自动尝试上限。`,
      finishedAt: now,
      runAfter: now,
    };
  }

  return {
    status: JobStatus.QUEUED,
    lastError: "任务执行超时，已自动重新排队。",
    finishedAt: now,
    runAfter: now,
  };
}

export async function claimNextQueuedJob(
  db: ContentDb,
  now = new Date(),
  options: {
    maxRunningJobs?: number;
  } = {},
) {
  if (options.maxRunningJobs) {
    return db.transaction(async (tx) => {
      // Serialize bounded claims across worker processes before counting RUNNING rows.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(86152865, 5200520)`);

      const result = await tx.execute(sql`
        WITH running_count AS (
          SELECT count(*)::int AS count
          FROM ${processingJobs}
          WHERE ${processingJobs.status} = ${JobStatus.RUNNING}
        ),
        next_job AS (
          SELECT ${processingJobs.id}
          FROM ${processingJobs}
          WHERE ${processingJobs.status} = ${JobStatus.QUEUED}
            AND ${processingJobs.runAfter} <= ${now}
            AND (SELECT count FROM running_count) < ${options.maxRunningJobs}
          ORDER BY ${processingJobs.runAfter} ASC, ${processingJobs.createdAt} ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE ${processingJobs}
        SET
          status = ${JobStatus.RUNNING},
          attempt = ${processingJobs.attempt} + 1,
          started_at = ${now},
          last_error = NULL
        WHERE ${processingJobs.id} IN (SELECT id FROM next_job)
        RETURNING
          id,
          article_id AS "articleId",
          job_type AS "jobType",
          status,
          pipeline_stage AS "pipelineStage",
          attempt,
          max_attempts AS "maxAttempts",
          last_error AS "lastError",
          run_after AS "runAfter",
          started_at AS "startedAt",
          finished_at AS "finishedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `);
      const rows = "rows" in result
        ? (result.rows as (typeof processingJobs.$inferSelect)[])
        : (result as unknown as (typeof processingJobs.$inferSelect)[]);

      return rows[0] ?? null;
    });
  }

  let attempts = 0;
  let delayMs = CLAIM_RETRY_BASE_DELAY_MS;

  while (true) {
    const job = await db.query.processingJobs.findFirst({
      where: (table, { and: whereAnd, eq: whereEq, lte: whereLte }) =>
        whereAnd(
          whereEq(table.status, JobStatus.QUEUED),
          whereLte(table.runAfter, now),
        ),
      orderBy: (table, { asc: orderAsc }) => [
        orderAsc(table.runAfter),
        orderAsc(table.createdAt),
      ],
    });

    if (!job) {
      return null;
    }

    const claimed = await db
      .update(processingJobs)
      .set({
        status: JobStatus.RUNNING,
        attempt: job.attempt + 1,
        startedAt: now,
        lastError: null,
      })
      .where(
        and(
          eq(processingJobs.id, job.id),
          eq(processingJobs.status, JobStatus.QUEUED),
        ),
      )
      .returning();

    if (claimed[0]) {
      return claimed[0];
    }

    attempts += 1;
    if (attempts >= CLAIM_RETRY_MAX_ATTEMPTS) {
      return null;
    }

    await waitMs(delayMs);
    delayMs = Math.min(delayMs * 2, CLAIM_RETRY_MAX_DELAY_MS);
  }
}

export async function countRunningJobs(db: ContentDb) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(processingJobs)
    .where(eq(processingJobs.status, JobStatus.RUNNING));

  return Number(row?.count ?? 0);
}

export async function claimQueuedJobById(
  db: ContentDb,
  jobId: string,
  now = new Date(),
) {
  const job = await db.query.processingJobs.findFirst({
    where: (table, { and: whereAnd, eq: whereEq }) =>
      whereAnd(
        whereEq(table.id, jobId),
        whereEq(table.status, JobStatus.QUEUED),
      ),
  });

  if (!job) {
    return null;
  }

  const claimed = await db
    .update(processingJobs)
    .set({
      status: JobStatus.RUNNING,
      attempt: job.attempt + 1,
      startedAt: now,
      lastError: null,
    })
    .where(
      and(
        eq(processingJobs.id, job.id),
        eq(processingJobs.status, JobStatus.QUEUED),
      ),
    )
    .returning();

  return claimed[0] ?? null;
}

export async function markJobSucceeded(
  db: ContentDb,
  jobId: string,
  now = new Date(),
) {
  await db
    .update(processingJobs)
    .set(buildJobSuccessUpdate(now))
    .where(eq(processingJobs.id, jobId));
}

export function buildJobSuccessUpdate(now = new Date()) {
  return {
    status: JobStatus.SUCCEEDED,
    pipelineStage: JobPipelineStage.COMPLETED,
    finishedAt: now,
  };
}

export async function markJobStage(
  db: ContentDb,
  jobId: string,
  pipelineStage: typeof JobPipelineStage[keyof typeof JobPipelineStage],
) {
  await db
    .update(processingJobs)
    .set({
      pipelineStage,
    })
    .where(eq(processingJobs.id, jobId));
}

export async function markJobFailed(
  db: ContentDb,
  input: {
    jobId: string;
    attempt: number;
    maxAttempts: number;
    error: string;
    now?: Date;
  },
) {
  const nextState = buildJobFailureUpdate(input);

  await db
    .update(processingJobs)
    .set(nextState)
    .where(eq(processingJobs.id, input.jobId));
}

export async function resetStaleRunningJobs(
  db: ContentDb,
  input: {
    now?: Date;
    staleAfterMinutes?: number;
  } = {},
) {
  const now = input.now ?? new Date();
  const staleAfterMinutes = input.staleAfterMinutes ?? 3;
  const staleBefore = new Date(now.getTime() - staleAfterMinutes * 60 * 1000);
  const runningJobs = await db.query.processingJobs.findMany({
    where: eq(processingJobs.status, JobStatus.RUNNING),
  });
  let resetCount = 0;
  let failedCount = 0;

  for (const job of runningJobs) {
    if (!job.startedAt || job.startedAt > staleBefore) {
      continue;
    }

    const nextState = buildStaleRunningJobUpdate({
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      now,
    });

    await db
      .update(processingJobs)
      .set(nextState)
      .where(eq(processingJobs.id, job.id));

    if (nextState.status === JobStatus.FAILED) {
      failedCount += 1;
    } else {
      resetCount += 1;
    }
  }

  return {
    resetCount,
    failedCount,
  };
}
