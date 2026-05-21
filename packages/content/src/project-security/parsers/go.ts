import type { DetectedDependencyFile, ResolvedDependency } from "../types"

type ParseGoDependencyFileInput = {
  rootDir: string
  file: DetectedDependencyFile
  content: string
}

type ParseGoDependencyFileResult = {
  packages: ResolvedDependency[]
  warnings: string[]
}

function toSortedPackages(packages: ResolvedDependency[]) {
  return [...packages].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name)
    if (nameComparison !== 0) {
      return nameComparison
    }

    return (left.version ?? "").localeCompare(right.version ?? "")
  })
}

function normalizeGoVersion(version: string) {
  return version.endsWith("/go.mod") ? version.slice(0, -"/go.mod".length) : version
}

function parseGoModLine(line: string) {
  const withoutComment = line.split("//")[0]?.trim() ?? ""
  if (!withoutComment) {
    return null
  }

  const match = withoutComment.match(/^([^\s]+)\s+(v[^\s]+)$/)
  if (!match?.[1] || !match[2]) {
    return null
  }

  return {
    name: match[1],
    version: match[2],
    dependencyType: line.includes("// indirect")
      ? ("transitive" as const)
      : ("direct" as const),
  }
}

export async function parseGoDependencyFile(
  input: ParseGoDependencyFileInput,
): Promise<ParseGoDependencyFileResult> {
  void input.rootDir

  if (input.file.path.endsWith("go.mod")) {
    const packages: ResolvedDependency[] = []
    let insideRequireBlock = false

    for (const line of input.content.split(/\r?\n/)) {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        continue
      }

      if (trimmedLine === "require (") {
        insideRequireBlock = true
        continue
      }

      if (insideRequireBlock && trimmedLine === ")") {
        insideRequireBlock = false
        continue
      }

      const candidateLine = insideRequireBlock
        ? trimmedLine
        : trimmedLine.startsWith("require ")
          ? trimmedLine.slice("require ".length).trim()
          : null

      if (!candidateLine) {
        continue
      }

      const parsedDependency = parseGoModLine(candidateLine)
      if (!parsedDependency) {
        continue
      }

      packages.push({
        ecosystem: "go",
        name: parsedDependency.name,
        version: parsedDependency.version,
        versionKind: "declared",
        dependencyType: parsedDependency.dependencyType,
        sourcePath: input.file.path,
        sourceKind: input.file.kind,
        confidence: "medium",
        note: "declared dependency without a lockfile",
      })
    }

    return {
      packages: toSortedPackages(packages),
      warnings: [],
    }
  }

  if (input.file.path.endsWith("go.sum")) {
    const packagesByCoordinate = new Map<string, ResolvedDependency>()

    for (const line of input.content.split(/\r?\n/)) {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        continue
      }

      const [name, rawVersion] = trimmedLine.split(/\s+/)
      if (!name || !rawVersion) {
        continue
      }

      const version = normalizeGoVersion(rawVersion)
      const key = `${name}@${version}`
      if (packagesByCoordinate.has(key)) {
        continue
      }

      packagesByCoordinate.set(key, {
        ecosystem: "go",
        name,
        version,
        versionKind: "observed",
        dependencyType: "unknown",
        sourcePath: input.file.path,
        sourceKind: input.file.kind,
        confidence: "low",
        note: "Go checksum entry observed without proving it is in the active dependency graph",
      })
    }

    return {
      packages: toSortedPackages([...packagesByCoordinate.values()]),
      warnings: [],
    }
  }

  return {
    packages: [],
    warnings: [`Unsupported Go file: ${input.file.path}`],
  }
}
