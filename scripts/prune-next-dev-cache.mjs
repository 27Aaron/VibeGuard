import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_MAX_NEXT_DEV_CACHE_BYTES = 1024 * 1024 * 1024;

function resolveMaxCacheBytes(value = process.env.NEXT_DEV_CACHE_MAX_BYTES) {
  if (!value) {
    return DEFAULT_MAX_NEXT_DEV_CACHE_BYTES;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_NEXT_DEV_CACHE_BYTES;
}

async function getDirectorySizeBytes(targetPath) {
  let total = 0;
  const entries = await fs.readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      total += await getDirectorySizeBytes(entryPath);
      continue;
    }

    if (entry.isFile()) {
      const stats = await fs.stat(entryPath);
      total += stats.size;
    }
  }

  return total;
}

export async function pruneNextDevCache({
  appDir = path.resolve(fileURLToPath(new URL("../apps/web", import.meta.url))),
  maxCacheBytes = resolveMaxCacheBytes(),
  logger = console,
} = {}) {
  const nextDevDir = path.join(appDir, ".next-dev");

  try {
    await fs.access(nextDevDir);
  } catch {
    return { cleared: false, sizeBytes: 0 };
  }

  const sizeBytes = await getDirectorySizeBytes(nextDevDir);

  if (sizeBytes <= maxCacheBytes) {
    return { cleared: false, sizeBytes };
  }

  await fs.rm(nextDevDir, { recursive: true, force: true });
  await fs.mkdir(nextDevDir, { recursive: true });
  logger.log(
    `[prune-next-dev-cache] Cleared oversized Next.js dev cache at ${nextDevDir} (${sizeBytes} bytes).`,
  );

  return { cleared: true, sizeBytes };
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  pruneNextDevCache().catch((error) => {
    console.error("[prune-next-dev-cache] Failed to inspect .next-dev cache.");
    console.error(error);
    process.exit(1);
  });
}
