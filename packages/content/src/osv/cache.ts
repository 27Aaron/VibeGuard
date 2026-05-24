import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";

export const OSV_VULNERABILITIES_BASE_URL =
  "https://storage.googleapis.com/osv-vulnerabilities";

export const OSV_DUMP_ECOSYSTEMS = ["npm", "PyPI", "Go", "crates.io"] as const;

export type OsvDumpEcosystem = (typeof OSV_DUMP_ECOSYSTEMS)[number];

type OsvCacheEnv = Record<string, string | undefined>;

type ResolveOsvCacheDirInput = {
  repoRoot?: string;
  env?: OsvCacheEnv;
};

type ResolveOsvBootstrapDirInput = ResolveOsvCacheDirInput;

type BuildOsvCachePathInput = ResolveOsvCacheDirInput & {
  ecosystem?: OsvDumpEcosystem;
  fileName?: string;
};

type BuildOsvBootstrapPathInput = ResolveOsvBootstrapDirInput & {
  ecosystem?: OsvDumpEcosystem;
  fileName?: string;
};

type DownloadOsvTextToCacheInput = ResolveOsvCacheDirInput & {
  ecosystem: OsvDumpEcosystem;
  fileName: string;
  url: string;
  fetchText?: (url: string) => Promise<string>;
};

type DownloadOsvArchiveToCacheInput = ResolveOsvBootstrapDirInput & {
  ecosystem: OsvDumpEcosystem;
  fileName: string;
  url: string;
  streamTo?: (url: string, destPath: string) => Promise<string>;
};

const DEFAULT_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);

export function assertSafeFileName(fileName: string) {
  if (
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("\0") ||
    fileName === "." ||
    fileName === ".."
  ) {
    throw new Error(`Unsafe OSV cache filename: ${fileName}`);
  }
}

export function resolveOsvCacheDir({
  repoRoot = DEFAULT_REPO_ROOT,
  env = process.env,
}: ResolveOsvCacheDirInput = {}) {
  const configured = env.VIBEGUARD_OSV_CACHE_DIR?.trim();

  if (!configured) {
    return path.join(repoRoot, "data", "osv-cache");
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(repoRoot, configured);
}

export function resolveOsvBootstrapDir({
  repoRoot = DEFAULT_REPO_ROOT,
  env = process.env,
}: ResolveOsvBootstrapDirInput = {}) {
  const configured = env.VIBEGUARD_OSV_BOOTSTRAP_DIR?.trim();

  if (!configured) {
    return path.join(repoRoot, "data", "osv-bootstrap");
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(repoRoot, configured);
}

export function buildOsvCachePath({
  repoRoot,
  env,
  ecosystem,
  fileName,
}: BuildOsvCachePathInput = {}) {
  const cacheDir = resolveOsvCacheDir({ repoRoot, env });
  const ecosystemDir = ecosystem ? path.join(cacheDir, ecosystem) : cacheDir;

  if (!fileName) {
    return ecosystemDir;
  }

  assertSafeFileName(fileName);

  return path.join(ecosystemDir, fileName);
}

export function buildOsvBootstrapPath({
  repoRoot,
  env,
  ecosystem,
  fileName,
}: BuildOsvBootstrapPathInput = {}) {
  const bootstrapDir = resolveOsvBootstrapDir({ repoRoot, env });
  const ecosystemDir = ecosystem
    ? path.join(bootstrapDir, ecosystem)
    : bootstrapDir;

  if (!fileName) {
    return ecosystemDir;
  }

  assertSafeFileName(fileName);

  return path.join(ecosystemDir, fileName);
}

export function buildOsvVulnerabilityUrl(
  ecosystem: OsvDumpEcosystem,
  vulnerabilityId: string,
) {
  return `${OSV_VULNERABILITIES_BASE_URL}/${encodeURIComponent(
    ecosystem,
  )}/${encodeURIComponent(vulnerabilityId)}.json`;
}

export function buildOsvBootstrapArchiveUrl(ecosystem: OsvDumpEcosystem) {
  return `${OSV_VULNERABILITIES_BASE_URL}/${encodeURIComponent(ecosystem)}/all.zip`;
}

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024; // 500MB

async function defaultFetchText(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download OSV file: ${response.status} ${url}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error(
      `Response too large: ${contentLength} bytes exceeds ${MAX_RESPONSE_BYTES} limit`,
    );
  }

  const text = await response.text();
  const byteLength = Buffer.byteLength(text, "utf8");
  if (byteLength > MAX_RESPONSE_BYTES) {
    throw new Error(
      `Response too large: ${byteLength} bytes exceeds ${MAX_RESPONSE_BYTES} limit`,
    );
  }

  return text;
}

async function defaultFetchBytes(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download OSV archive: ${response.status} ${url}`,
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error(
      `Response too large: ${contentLength} bytes exceeds ${MAX_RESPONSE_BYTES} limit`,
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error(
      `Response too large: ${buffer.byteLength} bytes exceeds ${MAX_RESPONSE_BYTES} limit`,
    );
  }

  return new Uint8Array(buffer);
}

async function streamArchiveToFile(url: string, destPath: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download OSV archive: ${response.status} ${url}`,
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_ARCHIVE_BYTES) {
    throw new Error(
      `Archive too large: ${contentLength} bytes exceeds ${MAX_ARCHIVE_BYTES} limit`,
    );
  }

  if (!response.body) {
    throw new Error("Response body is null, cannot stream archive");
  }

  const tmpPath = `${destPath}.tmp`;
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });

  const readable = Readable.fromWeb(
    response.body as unknown as NodeReadableStream<Uint8Array>,
  );
  const writable = createWriteStream(tmpPath);
  await pipeline(readable, writable);
  await fs.rename(tmpPath, destPath);

  return destPath;
}

export async function downloadOsvTextToCache({
  repoRoot,
  env,
  ecosystem,
  fileName,
  url,
  fetchText = defaultFetchText,
}: DownloadOsvTextToCacheInput) {
  const target = buildOsvCachePath({ repoRoot, env, ecosystem, fileName });
  const text = await fetchText(url);

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text, "utf8");

  return target;
}

export async function downloadOsvArchiveToCache({
  repoRoot,
  env,
  ecosystem,
  fileName,
  url,
  streamTo = streamArchiveToFile,
}: DownloadOsvArchiveToCacheInput) {
  const target = buildOsvBootstrapPath({ repoRoot, env, ecosystem, fileName });
  await streamTo(url, target);
  return target;
}

export async function deleteCachedOsvFile(filePath: string) {
  await fs.unlink(filePath);
}
