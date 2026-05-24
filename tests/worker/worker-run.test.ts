import { describe, expect, it } from "vitest";

import {
  buildWorkerRunErrorParams,
  buildWorkerRunRedirectParams,
  decodeWorkerRunDetails,
} from "../../apps/web/lib/worker-run";

describe("worker run redirect params", () => {
  it("builds success params from a clean cycle", () => {
    const params = buildWorkerRunRedirectParams(
      {
        activeFeedCount: 2,
        succeeded: ["feed-1", "feed-2"],
        failed: [],
        processedJobs: [
          { jobId: "job-1", articleId: "article-1", status: "succeeded" },
        ],
      },
      [
        {
          articleId: "article-1",
          title: "Translated article title",
          status: "succeeded",
        },
      ],
    );
    const details = decodeWorkerRunDetails(params.get("details") ?? undefined);

    expect(params.toString()).toContain("run=success");
    expect(params.get("feeds")).toBe("2");
    expect(params.get("jobs")).toBe("1");
    expect(details).toEqual([
      {
        articleId: "article-1",
        title: "Translated article title",
        status: "succeeded",
      },
    ]);
  });

  it("includes a compact warning message when some feeds fail", () => {
    const params = buildWorkerRunRedirectParams({
      activeFeedCount: 2,
      succeeded: ["feed-1"],
      failed: [{ feedId: "feed-2", error: "timeout while fetching" }],
      processedJobs: [],
    });

    expect(params.get("run")).toBe("warning");
    expect(params.get("message")).toContain("feed-2");
  });

  it("builds failure params from an exception", () => {
    const params = buildWorkerRunErrorParams(new Error("fatal worker error"));

    expect(params.get("run")).toBe("failed");
    expect(params.get("message")).toBe("fatal worker error");
  });

  it("returns an empty detail list for invalid payloads", () => {
    expect(decodeWorkerRunDetails("not-json")).toEqual([]);
  });
});
