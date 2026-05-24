import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("workspace typecheck script", () => {
  it("provides a root typecheck command for web and non-web packages", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.typecheck).toContain("tsc");
    expect(packageJson.scripts?.typecheck).toContain("apps/web");
  });
});
