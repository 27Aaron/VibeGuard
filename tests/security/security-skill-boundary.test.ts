import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("security skill boundary", () => {
  it("keeps project scanning in the local skill flow instead of server-side content helpers", () => {
    const envExample = fs.readFileSync(".env.example", "utf8");
    const contentIndex = fs.readFileSync(
      "packages/content/src/index.ts",
      "utf8",
    );

    expect(envExample).not.toContain("VIBEGUARD_PROJECT_SECURITY_");
    expect(contentIndex).not.toContain("project-security");
  });
});
