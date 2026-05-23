import type { DetectedDependencyFile, ResolvedDependency } from "../types"
import { toSortedPackages } from "./shared"

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

type ParsedCargoManifest = {
  dependencies: CargoManifestDependency[]
  packageName: string | null
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

function parseCargoManifest(content: string): ParsedCargoManifest {
  const dependencies: CargoManifestDependency[] = []
  let currentSection: string | null = null
  let packageName: string | null = null

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

    if (currentSection === "package") {
      const packageNameMatch = trimmedLine.match(/^name\s*=\s*"([^"]+)"$/)
      if (packageNameMatch?.[1]) {
        packageName = packageNameMatch[1]
      }
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

  return {
    dependencies,
    packageName,
  }
}

function toManifestPackages(
  file: DetectedDependencyFile,
  dependencies: CargoManifestDependency[],
) {
  return dependencies.map<ResolvedDependency>((dependency) => ({
    ecosystem: "crates-io",
    name: dependency.name,
    version: dependency.version,
    versionKind: "declared",
    dependencyType: "direct",
    sourcePath: file.path,
    sourceKind: file.kind,
    confidence: "medium",
    note: "declared dependency without a lockfile",
  }))
}

function isRegistryCargoSource(source: string | null) {
  if (!source) return false
  return (
    (source.startsWith("registry+") || source.startsWith("sparse+")) &&
    source.includes("crates.io")
  )
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
          parseCargoManifest(input.content).dependencies,
        ),
      ),
      warnings: [],
    }
  }

  if (input.file.path.endsWith("Cargo.lock")) {
    const parsedManifest = input.manifestContent
      ? parseCargoManifest(input.manifestContent)
      : null
    const directDependencyNames = new Set(
      parsedManifest?.dependencies.map((dependency) => dependency.name) ?? [],
    )
    const manifestPackageName = parsedManifest?.packageName ?? null
    const packages: ResolvedDependency[] = []

    let currentName: string | null = null
    let currentVersion: string | null = null
    let currentSource: string | null = null

    const flushCurrentPackage = () => {
      if (!currentName) {
        return
      }

      if (manifestPackageName && currentName === manifestPackageName) {
        return
      }

      if (!isRegistryCargoSource(currentSource)) {
        return
      }

      packages.push({
        ecosystem: "crates-io",
        name: currentName,
        version: currentVersion,
        versionKind: "resolved",
        dependencyType:
          directDependencyNames.size === 0
            ? "unknown"
            : directDependencyNames.has(currentName)
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
        currentSource = null
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
        continue
      }

      const sourceMatch = trimmedLine.match(/^source\s*=\s*"([^"]+)"$/)
      if (sourceMatch?.[1]) {
        currentSource = sourceMatch[1]
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
