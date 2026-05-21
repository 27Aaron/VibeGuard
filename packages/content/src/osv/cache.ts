import fs from "node:fs/promises"
import path from "node:path"

export const OSV_VULNERABILITIES_BASE_URL =
  "https://storage.googleapis.com/osv-vulnerabilities"

export const OSV_DUMP_ECOSYSTEMS = ["npm", "PyPI", "Go", "crates.io"] as const

export type OsvDumpEcosystem = (typeof OSV_DUMP_ECOSYSTEMS)[number]

type OsvCacheEnv = Record<string, string | undefined>

type ResolveOsvCacheDirInput = {
  repoRoot?: string
  env?: OsvCacheEnv
}

type BuildOsvCachePathInput = ResolveOsvCacheDirInput & {
  ecosystem?: OsvDumpEcosystem
  fileName?: string
}

type DownloadOsvTextToCacheInput = ResolveOsvCacheDirInput & {
  ecosystem: OsvDumpEcosystem
  fileName: string
  url: string
  fetchText?: (url: string) => Promise<string>
}

function assertSafeFileName(fileName: string) {
  if (
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName === "." ||
    fileName === ".."
  ) {
    throw new Error(`Unsafe OSV cache filename: ${fileName}`)
  }
}

export function resolveOsvCacheDir({
  repoRoot = process.cwd(),
  env = process.env,
}: ResolveOsvCacheDirInput = {}) {
  const configured = env.VIBEGUARD_OSV_CACHE_DIR?.trim()

  if (!configured) {
    return path.join(repoRoot, "data", "osv-cache")
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(repoRoot, configured)
}

export function buildOsvCachePath({
  repoRoot,
  env,
  ecosystem,
  fileName,
}: BuildOsvCachePathInput = {}) {
  const cacheDir = resolveOsvCacheDir({ repoRoot, env })
  const ecosystemDir = ecosystem ? path.join(cacheDir, ecosystem) : cacheDir

  if (!fileName) {
    return ecosystemDir
  }

  assertSafeFileName(fileName)

  return path.join(ecosystemDir, fileName)
}

export function buildOsvVulnerabilityUrl(
  ecosystem: OsvDumpEcosystem,
  vulnerabilityId: string,
) {
  return `${OSV_VULNERABILITIES_BASE_URL}/${encodeURIComponent(
    ecosystem,
  )}/${encodeURIComponent(vulnerabilityId)}.json`
}

async function defaultFetchText(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download OSV file: ${response.status} ${url}`)
  }

  return response.text()
}

export async function downloadOsvTextToCache({
  repoRoot,
  env,
  ecosystem,
  fileName,
  url,
  fetchText = defaultFetchText,
}: DownloadOsvTextToCacheInput) {
  const target = buildOsvCachePath({ repoRoot, env, ecosystem, fileName })
  const text = await fetchText(url)

  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text, "utf8")

  return target
}

export async function deleteCachedOsvFile(filePath: string) {
  await fs.rm(filePath, { force: true })
}
