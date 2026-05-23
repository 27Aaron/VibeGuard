import fs from "node:fs/promises"
import path from "node:path"

import { discoverDependencyFiles } from "./discover-dependency-files"
import { parseGoDependencyFile } from "./parsers/go"
import { parseNodeDependencyFile } from "./parsers/node"
import { parsePythonDependencyFile } from "./parsers/python"
import { parseRustDependencyFile } from "./parsers/rust"
import type {
  DetectedDependencyFile,
  ScanDependenciesInput,
  ScanDependenciesResult,
} from "./types"
import { normalizeInt } from "../shared/normalize"

const DEFAULT_MAX_DEPENDENCY_FILE_BYTES = 2 * 1024 * 1024

const MAX_DEPENDENCY_FILE_BYTES = normalizeInt(
  process.env.VIBEGUARD_PROJECT_SECURITY_MAX_DEPENDENCY_FILE_BYTES,
  DEFAULT_MAX_DEPENDENCY_FILE_BYTES,
)

function shouldSkipManifest(
  file: DetectedDependencyFile,
  successfulLockfiles: Set<string>,
) {
  if (
    file.kind !== "manifest" ||
    (file.ecosystem !== "npm" && file.ecosystem !== "crates-io")
  ) {
    return false
  }

  return successfulLockfiles.has(getDirectoryEcosystemKey(file))
}

function getDirectoryEcosystemKey(file: DetectedDependencyFile) {
  return `${file.ecosystem}:${path.posix.dirname(file.path)}`
}

function shouldPreferLockfileBeforeManifest(file: DetectedDependencyFile) {
  return file.ecosystem === "npm" || file.ecosystem === "crates-io"
}

function compareFilesForScan(left: DetectedDependencyFile, right: DetectedDependencyFile) {
  const leftKey = getDirectoryEcosystemKey(left)
  const rightKey = getDirectoryEcosystemKey(right)

  if (
    leftKey === rightKey &&
    shouldPreferLockfileBeforeManifest(left) &&
    shouldPreferLockfileBeforeManifest(right) &&
    left.kind !== right.kind
  ) {
    return left.kind === "lockfile" ? -1 : 1
  }

  return left.path.localeCompare(right.path)
}

function shouldRecordSuccessfulLockfile(
  file: DetectedDependencyFile,
  packages: ScanDependenciesResult["packages"],
) {
  return (
    file.kind === "lockfile" &&
    shouldPreferLockfileBeforeManifest(file) &&
    packages.length > 0
  )
}

async function parseDependencyFile(
  input: ScanDependenciesInput,
  file: DetectedDependencyFile,
  manifestCache: Map<string, Promise<string | undefined>>,
) {
  const absolutePath = path.join(input.rootDir, file.path)

  const stats = await fs.stat(absolutePath)

  if (stats.size > MAX_DEPENDENCY_FILE_BYTES) {
    throw new Error(
      `file is too large (${stats.size} bytes, max ${MAX_DEPENDENCY_FILE_BYTES})`,
    )
  }

  const content = await fs.readFile(absolutePath, "utf8")

  if (file.ecosystem === "npm") {
    return parseNodeDependencyFile({
      rootDir: input.rootDir,
      file,
      content,
    })
  }

  if (file.ecosystem === "pypi") {
    return parsePythonDependencyFile({
      rootDir: input.rootDir,
      file,
      content,
    })
  }

  if (file.ecosystem === "go") {
    return parseGoDependencyFile({
      rootDir: input.rootDir,
      file,
      content,
    })
  }

  const manifestPath = path.join(path.dirname(absolutePath), "Cargo.toml")
  let manifestPromise = manifestCache.get(manifestPath)
  if (!manifestPromise) {
    manifestPromise = fs.readFile(manifestPath, "utf8").catch(() => undefined)
    manifestCache.set(manifestPath, manifestPromise)
  }
  const manifestContent = await manifestPromise

  return parseRustDependencyFile({
    rootDir: input.rootDir,
    file,
    content,
    manifestContent,
  })
}

export async function scanDependencies(
  input: ScanDependenciesInput,
): Promise<ScanDependenciesResult> {
  const discovered = await discoverDependencyFiles({ rootDir: input.rootDir })
  const filesToScan = [...discovered.files].sort(compareFilesForScan)
  const packages: ScanDependenciesResult["packages"] = []
  const warnings = [...discovered.warnings]
  const successfulLockfiles = new Set<string>()
  const manifestCache = new Map<string, Promise<string | undefined>>()

  for (const file of filesToScan) {
    if (shouldSkipManifest(file, successfulLockfiles)) {
      continue
    }

    try {
      const result = await parseDependencyFile(input, file, manifestCache)
      packages.push(...result.packages)
      warnings.push(...result.warnings)
      if (shouldRecordSuccessfulLockfile(file, result.packages)) {
        successfulLockfiles.add(getDirectoryEcosystemKey(file))
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown dependency scan error"
      warnings.push(`Failed to scan dependency file ${file.path}: ${message}`)
    }
  }

  return {
    files: discovered.files,
    packages,
    warnings,
  }
}
