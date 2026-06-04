import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("public header sensitive surface links", () => {
  it("does not render API or MCP links from the shared public header", () => {
    const publicHeader = fs.readFileSync(
      "apps/web/components/public-header.tsx",
      "utf8",
    );

    expect(publicHeader).not.toContain('route: "/api"');
    expect(publicHeader).not.toContain('route: "/mcp"');
    expect(publicHeader).not.toContain("prefetch={");
  });
});
