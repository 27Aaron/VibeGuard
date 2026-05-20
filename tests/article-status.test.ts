import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ARTICLE_STATUS_VALUES,
  ArticleStatus,
  JOB_STATUS_VALUES,
  JobStatus,
  JOB_TYPE_VALUES,
  JobType,
} from "@vibeguard/shared";
import {
  articleStatusEnum,
  articleStatusValues,
  jobStatusEnum,
  jobStatusValues,
  jobTypeEnum,
  jobTypeValues,
} from "@vibeguard/db";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  vi.resetModules();

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("shared status enums", () => {
  it("should expose the full shared status collections", () => {
    expect(ARTICLE_STATUS_VALUES).toEqual([
      "pending",
      "processing",
      "ready",
      "failed",
      "filtered",
    ]);
    expect(Object.values(ArticleStatus)).toEqual(ARTICLE_STATUS_VALUES);

    expect(JOB_STATUS_VALUES).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
    ]);
    expect(Object.values(JobStatus)).toEqual(JOB_STATUS_VALUES);

    expect(JOB_TYPE_VALUES).toEqual([
      "extract",
      "translate",
      "summarize",
    ]);
    expect(Object.values(JobType)).toEqual(JOB_TYPE_VALUES);
  });

  it("should build db enums from the shared definitions", () => {
    expect(articleStatusValues).toBe(ARTICLE_STATUS_VALUES);
    expect(jobStatusValues).toBe(JOB_STATUS_VALUES);
    expect(jobTypeValues).toBe(JOB_TYPE_VALUES);

    expect(articleStatusEnum.enumValues).toStrictEqual(articleStatusValues);
    expect(jobStatusEnum.enumValues).toStrictEqual(jobStatusValues);
    expect(jobTypeEnum.enumValues).toStrictEqual(jobTypeValues);
  });

  it("should use the local VibeGuard database by default for migrations", async () => {
    delete process.env.DATABASE_URL;

    const config = await import("../drizzle.config");

    expect(config.default.dbCredentials).toEqual({
      url: "postgresql://postgres:postgres@127.0.0.1:5432/vibeguard",
    });
  });
});
