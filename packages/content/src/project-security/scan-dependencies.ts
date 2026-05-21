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

function shouldSkipManifest(
  file: DetectedDependencyFile,
  files: DetectedDependencyFile[],
) {
  if (file.kind !== "manifest") {
    return false
  }

  const directory = path.posix.dirname(file.path)

  return files.some(
    (candidate) =>
      candidate.ecosystem === file.ecosystem &&
      candidate.kind === "lockfile" &&
      path.posix.dirname(candidate.path) === directory,
  )
}

async function parseDependencyFile(
  input: ScanDependenciesInput,
  file: DetectedDependencyFile,
) {
  const absolutePath = path.join(input.rootDir, file.path)
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
  const manifestContent = await fs
    .readFile(manifestPath, "utf8")
    .catch(() => undefined)

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
  const packages: ScanDependenciesResult["packages"] = []
  const warnings = [...discovered.warnings]

  for (const file of discovered.files) {
    if (shouldSkipManifest(file, discovered.files)) {
      continue
    }

    const result = await parseDependencyFile(input, file)
    packages.push(...result.packages)
    warnings.push(...result.warnings)
  }

  return {
    files: discovered.files,
    packages,
    warnings,
  }
}
