import fs from "node:fs";

import { describe, expect, it } from "vitest";

const JOB_TABLE = fs.readFileSync(
  "apps/web/components/admin/job-table.tsx",
  "utf8",
);

describe("job-table virtualization", () => {
  it("defines a VIRTUALIZE_THRESHOLD constant to gate virtualization", () => {
    expect(JOB_TABLE).toContain("VIRTUALIZE_THRESHOLD");
    expect(JOB_TABLE).toMatch(/VIRTUALIZE_THRESHOLD = \d+/);
  });

  it("defines ESTIMATED_ROW_HEIGHT for containIntrinsicSize", () => {
    expect(JOB_TABLE).toContain("ESTIMATED_ROW_HEIGHT");
    expect(JOB_TABLE).toMatch(/ESTIMATED_ROW_HEIGHT = \d+/);
  });

  it("extracts JobRowItem into its own component for row-level containment", () => {
    expect(JOB_TABLE).toContain("function JobRowItem(");
    expect(JOB_TABLE).toContain("shouldVirtualize");
  });

  it("applies content-visibility: auto when shouldVirtualize is true", () => {
    expect(JOB_TABLE).toContain('contentVisibility: "auto"');
  });

  it("provides containIntrinsicSize so browser can estimate off-screen height", () => {
    expect(JOB_TABLE).toContain("containIntrinsicSize: ESTIMATED_ROW_HEIGHT");
  });

  it("gates virtualization based on job count exceeding threshold", () => {
    expect(JOB_TABLE).toContain("jobs.length > VIRTUALIZE_THRESHOLD");
  });

  it("adds overscroll-behavior: contain on the outer wrapper", () => {
    expect(JOB_TABLE).toContain('overscrollBehavior: "contain"');
  });

  it("extracts the pipeline progress IIFE into plain JSX in JobRowItem", () => {
    // The IIFE pattern {(() => { ... })()} should be gone from JobRowItem
    const rowItemStart = JOB_TABLE.indexOf("function JobRowItem(");
    const rowItemEnd = JOB_TABLE.indexOf("function JobTable(", rowItemStart);
    const rowItemBody = JOB_TABLE.slice(rowItemStart, rowItemEnd);

    expect(rowItemBody).not.toMatch(/\(\(\) => \{/);
    expect(rowItemBody).toContain("pipelineProgress(job)");
    expect(rowItemBody).toContain("Math.round((current / total) * 100)");
  });

  it("JobRowItem is rendered via jobs.map with key and shouldVirtualize prop", () => {
    expect(JOB_TABLE).toMatch(/jobs\.map\(\(job\) =>/);
    expect(JOB_TABLE).toContain("<JobRowItem");
    expect(JOB_TABLE).toContain("shouldVirtualize={shouldVirtualize}");
  });
});
