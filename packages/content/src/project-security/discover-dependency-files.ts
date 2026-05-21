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
])

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
  const files: DetectedDependencyFile[] = []
  const warnings: string[] = []

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue
        }

        await walk(path.join(currentDir, entry.name))
        continue
      }

      const rule = FILE_RULES.find((candidate) => candidate.name === entry.name)
      if (!rule) {
        continue
      }

      files.push({
        ecosystem: rule.ecosystem,
        kind: rule.kind,
        path: toRelativePath(input.rootDir, path.join(currentDir, entry.name)),
        confidence: rule.confidence,
        note: `${rule.kind} discovered during recursive scan`,
      })
    }
  }

  try {
    await walk(input.rootDir)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnings.push(`Failed to scan dependency files in ${input.rootDir}: ${message}`)
  }

  files.sort((left, right) => left.path.localeCompare(right.path))

  return { files, warnings }
}
