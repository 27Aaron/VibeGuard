import type { DetectedDependencyFile, ResolvedDependency } from "../types"

type ParseRustDependencyFileInput = {
  rootDir: string
  file: DetectedDependencyFile
  content: string
  manifestContent?: string
}

type ParseRustDependencyFileResult = {
  packages: ResolvedDependency[]
  warnings: string[]
}

type CargoManifestDependency = {
  name: string
  version: string | null
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

function isCargoDependencySection(sectionName: string) {
  return (
    sectionName === "dependencies" ||
    sectionName === "dev-dependencies" ||
    sectionName === "build-dependencies" ||
    sectionName === "workspace.dependencies" ||
    sectionName.endsWith(".dependencies") ||
    sectionName.endsWith(".dev-dependencies") ||
    sectionName.endsWith(".build-dependencies")
  )
}

function normalizeCargoVersion(rawVersion: string | null) {
  if (!rawVersion) {
    return null
  }

  return rawVersion.trim() || null
}

function parseCargoManifestDependencies(
  content: string,
): CargoManifestDependency[] {
  const dependencies: CargoManifestDependency[] = []
  let currentSection: string | null = null

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue
    }

    const sectionMatch = trimmedLine.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1] ?? null
      continue
    }

    if (!currentSection || !isCargoDependencySection(currentSection)) {
      continue
    }

    const dependencyMatch = trimmedLine.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/)
    if (!dependencyMatch) {
      continue
    }

    const [, name, definition] = dependencyMatch
    if (!name || !definition) {
      continue
    }

    const inlineVersionMatch = definition.match(/^"([^"]+)"$/)
    const tableVersionMatch = definition.match(/version\s*=\s*"([^"]+)"/)

    dependencies.push({
      name,
      version: normalizeCargoVersion(
        inlineVersionMatch?.[1] ?? tableVersionMatch?.[1] ?? null,
      ),
    })
  }

  return dependencies
}

function toManifestPackages(
  file: DetectedDependencyFile,
  dependencies: CargoManifestDependency[],
) {
  return dependencies.map<ResolvedDependency>((dependency) => ({
    ecosystem: "crates-io",
    name: dependency.name,
    version: dependency.version,
    dependencyType: "direct",
    sourcePath: file.path,
    sourceKind: file.kind,
    confidence: "medium",
    note: "declared dependency without a lockfile",
  }))
}

export async function parseRustDependencyFile(
  input: ParseRustDependencyFileInput,
): Promise<ParseRustDependencyFileResult> {
  void input.rootDir

  if (input.file.path.endsWith("Cargo.toml")) {
    return {
      packages: toSortedPackages(
        toManifestPackages(
          input.file,
          parseCargoManifestDependencies(input.content),
        ),
      ),
      warnings: [],
    }
  }

  if (input.file.path.endsWith("Cargo.lock")) {
    const directDependencyNames = new Set(
      parseCargoManifestDependencies(input.manifestContent ?? "").map(
        (dependency) => dependency.name,
      ),
    )
    const packages: ResolvedDependency[] = []

    let currentName: string | null = null
    let currentVersion: string | null = null

    const flushCurrentPackage = () => {
      if (!currentName) {
        return
      }

      packages.push({
        ecosystem: "crates-io",
        name: currentName,
        version: currentVersion,
        dependencyType: directDependencyNames.has(currentName)
          ? "direct"
          : "transitive",
        sourcePath: input.file.path,
        sourceKind: input.file.kind,
        confidence: "high",
        note: "resolved from Cargo.lock",
      })
    }

    for (const line of input.content.split(/\r?\n/)) {
      const trimmedLine = line.trim()

      if (trimmedLine === "[[package]]") {
        flushCurrentPackage()
        currentName = null
        currentVersion = null
        continue
      }

      const nameMatch = trimmedLine.match(/^name\s*=\s*"([^"]+)"$/)
      if (nameMatch?.[1]) {
        currentName = nameMatch[1]
        continue
      }

      const versionMatch = trimmedLine.match(/^version\s*=\s*"([^"]+)"$/)
      if (versionMatch?.[1]) {
        currentVersion = versionMatch[1]
      }
    }

    flushCurrentPackage()

    return {
      packages: toSortedPackages(packages),
      warnings: [],
    }
  }

  return {
    packages: [],
    warnings: [`Unsupported Rust file: ${input.file.path}`],
  }
}
