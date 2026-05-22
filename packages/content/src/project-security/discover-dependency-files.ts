import fs from "node:fs/promises"
import path from "node:path"

import type {
  DependencyParseConfidence,
  DetectedDependencyFile,
  DiscoverDependencyFilesInput,
  DiscoverDependencyFilesResult,
} from "./types"

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".worktrees",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vscode",
  ".idea",
  "vendor",
])

const DEFAULT_MAX_DISCOVERY_DEPTH = 10
const DEFAULT_MAX_DISCOVERY_FILES = 2000

function normalizeInt(value: string | undefined, fallback: number, minimum = 1) {
  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}

const MAX_DISCOVERY_DEPTH = normalizeInt(
  process.env.VIBEGUARD_PROJECT_SECURITY_MAX_DISCOVERY_DEPTH,
  DEFAULT_MAX_DISCOVERY_DEPTH,
)
const MAX_DISCOVERY_FILES = normalizeInt(
  process.env.VIBEGUARD_PROJECT_SECURITY_MAX_DISCOVERY_FILES,
  DEFAULT_MAX_DISCOVERY_FILES,
)

const FILE_RULES = [
  {
    name: "package-lock.json",
    ecosystem: "npm",
    kind: "lockfile",
    confidence: "high",
  },
  {
    name: "pnpm-lock.yaml",
    ecosystem: "npm",
    kind: "lockfile",
    confidence: "high",
  },
  {
    name: "yarn.lock",
    ecosystem: "npm",
    kind: "lockfile",
    confidence: "high",
  },
  {
    name: "package.json",
    ecosystem: "npm",
    kind: "manifest",
    confidence: "medium",
  },
  {
    name: "requirements.txt",
    ecosystem: "pypi",
    kind: "manifest",
    confidence: "medium",
  },
  {
    name: "poetry.lock",
    ecosystem: "pypi",
    kind: "lockfile",
    confidence: "high",
  },
  {
    name: "pyproject.toml",
    ecosystem: "pypi",
    kind: "manifest",
    confidence: "medium",
  },
  {
    name: "go.mod",
    ecosystem: "go",
    kind: "manifest",
    confidence: "medium",
  },
  {
    name: "go.sum",
    ecosystem: "go",
    kind: "lockfile",
    confidence: "high",
  },
  {
    name: "Cargo.lock",
    ecosystem: "crates-io",
    kind: "lockfile",
    confidence: "high",
  },
  {
    name: "Cargo.toml",
    ecosystem: "crates-io",
    kind: "manifest",
    confidence: "medium",
  },
] as const satisfies readonly {
  name: string
  ecosystem: DetectedDependencyFile["ecosystem"]
  kind: DetectedDependencyFile["kind"]
  confidence: DependencyParseConfidence
}[]

function toRelativePath(rootDir: string, absolutePath: string) {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/")
}

export async function discoverDependencyFiles(
  input: DiscoverDependencyFilesInput,
): Promise<DiscoverDependencyFilesResult> {
  const rootDir = path.resolve(input.rootDir)
  const files: DetectedDependencyFile[] = []
  const warnings: string[] = []
  let discoveredLimitReached = false
  let depthLimitReached = false

  function isWithinRoot(absolutePath: string) {
    const relativePath = path.relative(rootDir, path.resolve(absolutePath))

    return (
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    )
  }

  async function walk(currentDir: string, depth = 0) {
    if (discoveredLimitReached) {
      return
    }

    if (depth > MAX_DISCOVERY_DEPTH) {
      depthLimitReached = true
      return
    }

    let entries: fs.Dirent[]
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true })
    } catch (error) {
      if (path.resolve(currentDir) === rootDir) {
        throw error
      }

      warnings.push(
        `Failed to scan directory ${path.relative(rootDir, currentDir) || "."}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      )
      return
    }

    for (const entry of entries) {
      if (discoveredLimitReached || depth > MAX_DISCOVERY_DEPTH) {
        return
      }

      const absolutePath = path.join(currentDir, entry.name)

      if (entry.isSymbolicLink() || !isWithinRoot(absolutePath)) {
        continue
      }

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue
        }

        await walk(absolutePath, depth + 1)

        if (discoveredLimitReached) {
          return
        }

        continue
      }

      const rule = FILE_RULES.find((candidate) => candidate.name === entry.name)
      if (!rule) {
        continue
      }

      files.push({
        ecosystem: rule.ecosystem,
        kind: rule.kind,
        path: toRelativePath(rootDir, absolutePath),
        confidence: rule.confidence,
        note: `${rule.kind} discovered during recursive scan`,
      })

      if (files.length >= MAX_DISCOVERY_FILES) {
        discoveredLimitReached = true
        warnings.push(
          `Dependency file discovery stopped at ${MAX_DISCOVERY_FILES} files. Set VIBEGUARD_PROJECT_SECURITY_MAX_DISCOVERY_FILES to a larger value if needed.`,
        )
        return
      }
    }
  }

  await walk(input.rootDir)

  if (depthLimitReached) {
    warnings.push(
      `Dependency scan stopped at depth ${MAX_DISCOVERY_DEPTH}. Set VIBEGUARD_PROJECT_SECURITY_MAX_DISCOVERY_DEPTH to a larger value if needed.`,
    )
  }

  files.sort((left, right) => left.path.localeCompare(right.path))

  return { files, warnings }
}
