import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import {
  deleteCacheFile,
  downloadToCache,
  resolveEnrichmentCacheDir,
} from "../../packages/content/src/security/cache";

describe("enrichment cache directory resolution", () => {
  it("defaults to data/enrichment-cache under the repo root", () => {
    expect(resolveEnrichmentCacheDir({ repoRoot: "/tmp/vibeguard" })).toBe(
      path.join("/tmp/vibeguard", "data", "enrichment-cache"),
    );
  });

  it("uses an absolute VIBEGUARD_ENRICHMENT_CACHE_DIR as-is", () => {
    expect(
      resolveEnrichmentCacheDir({
        repoRoot: "/tmp/vibeguard",
        env: { VIBEGUARD_ENRICHMENT_CACHE_DIR: "/var/lib/vibeguard/enrichment" },
      }),
    ).toBe("/var/lib/vibeguard/enrichment");
  });

  it("resolves a relative VIBEGUARD_ENRICHMENT_CACHE_DIR against repo root", () => {
    expect(
      resolveEnrichmentCacheDir({
        repoRoot: "/tmp/vibeguard",
        env: { VIBEGUARD_ENRICHMENT_CACHE_DIR: "cache/enrichment" },
      }),
    ).toBe(path.resolve("/tmp/vibeguard", "cache/enrichment"));
  });

  it("ignores a blank VIBEGUARD_ENRICHMENT_CACHE_DIR", () => {
    expect(
      resolveEnrichmentCacheDir({
        repoRoot: "/tmp/vibeguard",
        env: { VIBEGUARD_ENRICHMENT_CACHE_DIR: "   " },
      }),
    ).toBe(path.join("/tmp/vibeguard", "data", "enrichment-cache"));
  });
});

describe("downloadToCache", () => {
  it("downloads a remote file to the enrichment cache directory", async () => {
    const repoRoot = fs.mkdtempSync(
      path.join("/tmp", "vibeguard-enrichment-cache-"),
    );

    const body = '{"vulnerabilities": []}';
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "content-length": String(Buffer.byteLength(body)) },
      }),
    ) as never;

    const result = await downloadToCache({
      url: "https://example.test/kev.json",
      fileName: "cisa-kev.json",
      repoRoot,
    });

    expect(result).toBe(
      path.join(repoRoot, "data", "enrichment-cache", "cisa-kev.json"),
    );
    expect(fs.readFileSync(result, "utf8")).toBe(body);
  });

  it("rejects responses that exceed the byte limit based on content-length", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("", {
        status: 200,
        headers: { "content-length": "2048" },
      }),
    ) as never;

    await expect(
      downloadToCache({
        url: "https://example.test/big.json",
        fileName: "big.json",
        maxBytes: 1024,
        repoRoot: "/tmp/vibeguard",
      }),
    ).rejects.toThrow(/too large/);
  });

  it("rejects non-2xx responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    ) as never;

    await expect(
      downloadToCache({
        url: "https://example.test/missing",
        fileName: "missing.json",
        repoRoot: "/tmp/vibeguard",
      }),
    ).rejects.toThrow(/Failed to download enrichment feed: 404/);
  });
});

describe("deleteCacheFile", () => {
  it("removes an existing cache file", async () => {
    const dir = fs.mkdtempSync(path.join("/tmp", "vibeguard-cache-del-"));
    const file = path.join(dir, "test.json");
    fs.writeFileSync(file, '{"ok":true}');

    await deleteCacheFile(file);

    expect(fs.existsSync(file)).toBe(false);
  });

  it("silently ignores missing files", async () => {
    await expect(
      deleteCacheFile("/tmp/vibeguard-nonexistent-cache-file.json"),
    ).resolves.toBeUndefined();
  });
});

describe(".gitignore", () => {
  it("explicitly ignores enrichment cache downloads", () => {
    const gitignore = fs.readFileSync(".gitignore", "utf8");

    expect(gitignore).toContain("data/enrichment-cache/");
  });
});
