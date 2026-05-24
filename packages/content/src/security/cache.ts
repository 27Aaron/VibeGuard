import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";

type CacheEnv = Record<string, string | undefined>;

type ResolveCacheDirInput = {
  repoRoot?: string;
  env?: CacheEnv;
};

const DEFAULT_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);

export function resolveEnrichmentCacheDir({
  repoRoot = DEFAULT_REPO_ROOT,
  env = process.env,
}: ResolveCacheDirInput = {}) {
  const configured = env.VIBEGUARD_ENRICHMENT_CACHE_DIR?.trim();

  if (!configured) {
    return path.join(repoRoot, "data", "enrichment-cache");
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(repoRoot, configured);
}

type DownloadToCacheInput = ResolveCacheDirInput & {
  url: string;
  fileName: string;
  maxBytes?: number;
};

const DEFAULT_MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024;

export async function downloadToCache({
  url,
  fileName,
  maxBytes = DEFAULT_MAX_DOWNLOAD_BYTES,
  ...dirInput
}: DownloadToCacheInput) {
  const cacheDir = resolveEnrichmentCacheDir(dirInput);
  const target = path.join(cacheDir, fileName);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download enrichment feed: ${response.status} ${url}`,
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(
      `Enrichment feed too large: ${contentLength} bytes exceeds ${maxBytes} limit`,
    );
  }

  if (!response.body) {
    throw new Error("Response body is null, cannot download to cache");
  }

  const tmpPath = `${target}.tmp`;
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });

  const readable = Readable.fromWeb(
    response.body as unknown as NodeReadableStream<Uint8Array>,
  );
  const writable = createWriteStream(tmpPath);
  await pipeline(readable, writable);
  await fs.rename(tmpPath, target);

  return target;
}

export async function deleteCacheFile(filePath: string) {
  await fs.unlink(filePath).catch(() => {});
}
