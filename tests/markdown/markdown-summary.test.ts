import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeSummaryMarkdownHeadings } from "../../apps/web/lib/markdown-summary";

describe("markdown summary rendering", () => {
  it("removes h1 and h2 markers from summaries while preserving the text", () => {
    const markdown = [
      "# Risk update",
      "",
      "## Impact",
      "",
      "### Timeline",
      "",
      "- **npm** package remains linked as [details](https://example.com).",
    ].join("\n");

    expect(normalizeSummaryMarkdownHeadings(markdown)).toBe(
      [
        "Risk update",
        "",
        "Impact",
        "",
        "### Timeline",
        "",
        "- **npm** package remains linked as [details](https://example.com).",
      ].join("\n"),
    );
  });

  it("keeps fenced code content unchanged", () => {
    expect(
      normalizeSummaryMarkdownHeadings(
        [
          "```sh",
          "# still a shell comment",
          "## still a shell comment",
          "```",
        ].join("\n"),
      ),
    ).toBe(
      [
        "```sh",
        "# still a shell comment",
        "## still a shell comment",
        "```",
      ].join("\n"),
    );
  });

  it("normalizes only the MarkdownSummary input", () => {
    const renderer = fs.readFileSync(
      "apps/web/components/content/markdown-renderer.tsx",
      "utf8",
    );

    expect(renderer).toContain(
      'import { normalizeSummaryMarkdownHeadings } from "@/lib/markdown-summary"',
    );
    expect(renderer).toContain(
      "content={normalizeSummaryMarkdownHeadings(content)}",
    );
    expect(renderer).toContain("h1: ({ children })");
    expect(renderer).toContain("h2: ({ children })");
  });
});
