import type { DetectedDependencyFile, ResolvedDependency } from "../types"

type ParseNodeDependencyFileInput = {
  rootDir: string
  file: DetectedDependencyFile
  content: string
}

type ParseNodeDependencyFileResult = {
  packages: ResolvedDependency[]
  warnings: string[]
}

type PackageLockData = {
  packages?: Record<
    string,
    {
      version?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
  >
}

type PackageManifestData = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function toSortedPackages(packages: ResolvedDependency[]) {
  return [...packages].sort((left, right) => left.name.localeCompare(right.name))
}

function extractNodePackageName(packagePath: string) {
  const segments = packagePath.split("node_modules/")
  return segments[segments.length - 1] ?? packagePath
}

function isInstalledNodePackagePath(packagePath: string) {
  return packagePath.includes("node_modules/")
}

export async function parseNodeDependencyFile(
  input: ParseNodeDependencyFileInput,
): Promise<ParseNodeDependencyFileResult> {
  if (input.file.path.endsWith("package-lock.json")) {
    const parsed = JSON.parse(input.content) as PackageLockData
    const rootPackage = parsed.packages?.[""]
    const directDependencies = new Set([
      ...Object.keys(rootPackage?.dependencies ?? {}),
      ...Object.keys(rootPackage?.devDependencies ?? {}),
    ])

    const packages = Object.entries(parsed.packages ?? {})
      .filter(([packagePath]) => isInstalledNodePackagePath(packagePath))
      .map(([packagePath, pkg]) => {
        const name = extractNodePackageName(packagePath)

        return {
          ecosystem: "npm" as const,
          name,
          version: pkg.version ?? null,
          dependencyType: directDependencies.has(name)
            ? ("direct" as const)
            : ("transitive" as const),
          sourcePath: input.file.path,
          sourceKind: "lockfile" as const,
          confidence: "high" as const,
          note: "resolved from package-lock.json",
        }
      })

    return {
      packages: toSortedPackages(packages),
      warnings: [],
    }
  }

  if (input.file.path.endsWith("package.json")) {
    const parsed = JSON.parse(input.content) as PackageManifestData
    const packages = Object.entries({
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {}),
    }).map(([name, version]) => ({
      ecosystem: "npm" as const,
      name,
      version,
      dependencyType: "direct" as const,
      sourcePath: input.file.path,
      sourceKind: "manifest" as const,
      confidence: "medium" as const,
      note: "declared dependency without a lockfile",
    }))

    return {
      packages: toSortedPackages(packages),
      warnings: [],
    }
  }

  return {
    packages: [],
    warnings: [`Unsupported Node file: ${input.file.path}`],
  }
}
