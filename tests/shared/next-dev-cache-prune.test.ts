import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { pruneNextDevCache } from "../../scripts/prune-next-dev-cache.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempAppDir() {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "vibeguard-next-dev-cache-"),
  );
  tempDirs.push(dir);
  return dir;
}

describe("pruneNextDevCache", () => {
  it("is wired into the web dev script before Next.js starts", () => {
    const webPackage = fs.readFileSync("apps/web/package.json", "utf8");

    expect(webPackage).toContain("node ../../scripts/prune-next-dev-cache.mjs");
    expect(webPackage).toContain(
      "node ../../scripts/with-env.mjs --local-defaults next dev",
    );
  });

  it("leaves a healthy .next-dev cache in place", async () => {
    const appDir = createTempAppDir();
    const nextDevDir = path.join(appDir, ".next-dev");
    const nestedFile = path.join(nextDevDir, "dev", "types", "routes.d.ts");
    const logger = { log: vi.fn() };

    fs.mkdirSync(path.dirname(nestedFile), { recursive: true });
    fs.writeFileSync(nestedFile, "small-cache");

    const result = await pruneNextDevCache({
      appDir,
      maxCacheBytes: 1024,
      logger,
    });

    expect(result).toEqual({ cleared: false, sizeBytes: 11 });
    expect(fs.existsSync(nestedFile)).toBe(true);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it("removes and recreates an oversized .next-dev cache", async () => {
    const appDir = createTempAppDir();
    const nextDevDir = path.join(appDir, ".next-dev");
    const nestedFile = path.join(nextDevDir, "dev", "cache", "artifact.bin");
    const logger = { log: vi.fn() };

    fs.mkdirSync(path.dirname(nestedFile), { recursive: true });
    fs.writeFileSync(nestedFile, "oversized-cache");

    const result = await pruneNextDevCache({
      appDir,
      maxCacheBytes: 8,
      logger,
    });

    expect(result).toEqual({ cleared: true, sizeBytes: 15 });
    expect(fs.existsSync(nextDevDir)).toBe(true);
    expect(fs.readdirSync(nextDevDir)).toEqual([]);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("Cleared oversized Next.js dev cache"),
    );
  });
});
