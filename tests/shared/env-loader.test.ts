import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadRootEnv } from "../../scripts/load-env.mjs";

const TEST_KEYS = [
  "VIBEGUARD_ENV_TEST_VALUE",
  "VIBEGUARD_ENV_TEST_LOCAL_ONLY",
  "VIBEGUARD_ENV_TEST_EXTERNAL",
];

afterEach(() => {
  for (const key of TEST_KEYS) {
    delete process.env[key];
  }
});

describe("loadRootEnv", () => {
  it("loads root .env and lets .env.local override it", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeguard-env-"));

    fs.writeFileSync(
      path.join(rootDir, ".env"),
      "VIBEGUARD_ENV_TEST_VALUE=from-env\n",
    );
    fs.writeFileSync(
      path.join(rootDir, ".env.local"),
      [
        "VIBEGUARD_ENV_TEST_VALUE=from-local",
        "VIBEGUARD_ENV_TEST_LOCAL_ONLY='local secret'",
      ].join("\n"),
    );

    loadRootEnv({ rootDir });

    expect(process.env.VIBEGUARD_ENV_TEST_VALUE).toBe("from-local");
    expect(process.env.VIBEGUARD_ENV_TEST_LOCAL_ONLY).toBe("local secret");
  });

  it("keeps explicitly provided process env values", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibeguard-env-"));
    process.env.VIBEGUARD_ENV_TEST_EXTERNAL = "from-shell";

    fs.writeFileSync(
      path.join(rootDir, ".env"),
      "VIBEGUARD_ENV_TEST_EXTERNAL=from-env\n",
    );

    loadRootEnv({ rootDir });

    expect(process.env.VIBEGUARD_ENV_TEST_EXTERNAL).toBe("from-shell");
  });
});
