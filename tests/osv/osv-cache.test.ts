import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildOsvCachePath,
  buildOsvBootstrapArchiveUrl,
  buildOsvBootstrapPath,
  buildOsvVulnerabilityUrl,
  deleteCachedOsvFile,
  resolveOsvBootstrapDir,
  downloadOsvTextToCache,
  resolveOsvCacheDir,
} from "../../packages/content/src/osv/cache";

describe("OSV cache paths", () => {
  it("keeps downloaded OSV files under the repository data/osv-cache directory", () => {
    const repoRoot = "/tmp/vibeguard";

    expect(resolveOsvCacheDir({ repoRoot })).toBe(
      path.join(repoRoot, "data", "osv-cache"),
    );
    expect(buildOsvCachePath({ repoRoot, ecosystem: "npm" })).toBe(
      path.join(repoRoot, "data", "osv-cache", "npm"),
    );
    expect(
      buildOsvCachePath({
        repoRoot,
        ecosystem: "PyPI",
        fileName: "modified_id.csv",
      }),
    ).toBe(path.join(repoRoot, "data", "osv-cache", "PyPI", "modified_id.csv"));
    expect(resolveOsvBootstrapDir({ repoRoot })).toBe(
      path.join(repoRoot, "data", "osv-bootstrap"),
    );
    expect(buildOsvBootstrapPath({ repoRoot, ecosystem: "npm" })).toBe(
      path.join(repoRoot, "data", "osv-bootstrap", "npm"),
    );
    expect(
      buildOsvBootstrapPath({
        repoRoot,
        ecosystem: "Go",
        fileName: "all.zip",
      }),
    ).toBe(path.join(repoRoot, "data", "osv-bootstrap", "Go", "all.zip"));
  });

  it("defaults to the repository data directories instead of the caller cwd", () => {
    const originalCwd = process.cwd();
    const expectedRepoRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../..",
    );

    try {
      process.chdir("/tmp");

      expect(resolveOsvCacheDir()).toBe(
        path.join(expectedRepoRoot, "data", "osv-cache"),
      );
      expect(resolveOsvBootstrapDir()).toBe(
        path.join(expectedRepoRoot, "data", "osv-bootstrap"),
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("allows an explicit cache directory override for deployment", () => {
    expect(
      resolveOsvCacheDir({
        repoRoot: "/tmp/vibeguard",
        env: { VIBEGUARD_OSV_CACHE_DIR: "/var/lib/vibeguard/osv" },
      }),
    ).toBe("/var/lib/vibeguard/osv");
  });

  it("builds canonical OSV vulnerability URLs", () => {
    expect(buildOsvVulnerabilityUrl("npm", "MAL-2026-4230")).toBe(
      "https://storage.googleapis.com/osv-vulnerabilities/npm/MAL-2026-4230.json",
    );
    expect(buildOsvVulnerabilityUrl("crates.io", "GHSA-test")).toBe(
      "https://storage.googleapis.com/osv-vulnerabilities/crates.io/GHSA-test.json",
    );
    expect(buildOsvBootstrapArchiveUrl("PyPI")).toBe(
      "https://storage.googleapis.com/osv-vulnerabilities/PyPI/all.zip",
    );
  });

  it("downloads OSV text files into the repo-local cache", async () => {
    const repoRoot = fs.mkdtempSync(path.join("/tmp", "vibeguard-osv-cache-"));
    const target = await downloadOsvTextToCache({
      repoRoot,
      ecosystem: "npm",
      fileName: "modified_id.csv",
      url: "https://storage.googleapis.com/osv-vulnerabilities/npm/modified_id.csv",
      fetchText: async () => "2026-05-21T23:01:37Z,MAL-2026-4230\n",
    });

    expect(target).toBe(
      path.join(repoRoot, "data", "osv-cache", "npm", "modified_id.csv"),
    );
    expect(fs.readFileSync(target, "utf8")).toBe(
      "2026-05-21T23:01:37Z,MAL-2026-4230\n",
    );
  });

  it("can remove cached OSV files after they are parsed", async () => {
    const repoRoot = fs.mkdtempSync(path.join("/tmp", "vibeguard-osv-cache-"));
    const target = buildOsvCachePath({
      repoRoot,
      ecosystem: "npm",
      fileName: "MAL-2026-4230.json",
    });

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '{"id":"MAL-2026-4230"}');

    await deleteCachedOsvFile(target);

    expect(fs.existsSync(target)).toBe(false);
  });
});

describe(".gitignore", () => {
  it("explicitly ignores repo-local OSV downloads", () => {
    const gitignore = fs.readFileSync(".gitignore", "utf8");

    expect(gitignore).toContain("data/osv-cache/");
    expect(gitignore).toContain("data/osv-bootstrap/");
  });
});
