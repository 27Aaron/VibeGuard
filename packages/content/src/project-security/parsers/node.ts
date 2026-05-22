import type { DetectedDependencyFile, ResolvedDependency } from "../types"
import { toSortedPackages } from "./shared"

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

type DirectDependenciesByContext = Map<string, Set<string>>

function extractNodePackageName(packagePath: string) {
  const segments = packagePath.split("node_modules/")
  return segments[segments.length - 1] ?? packagePath
}

function isInstalledNodePackagePath(packagePath: string) {
  return packagePath.includes("node_modules/")
}

function collectDeclaredDirectDependencies(parsed: PackageLockData) {
  const directDependenciesByContext: DirectDependenciesByContext = new Map()

  for (const [packagePath, pkg] of Object.entries(parsed.packages ?? {})) {
    if (isInstalledNodePackagePath(packagePath)) {
      continue
    }

    directDependenciesByContext.set(
      packagePath,
      new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ]),
    )
  }

  return directDependenciesByContext
}

function getInstalledPackageContext(packagePath: string) {
  const suffix = "/node_modules/"

  if (packagePath.startsWith("node_modules/")) {
    return ""
  }

  const lastIndex = packagePath.lastIndexOf(suffix)

  if (lastIndex === -1) {
    return null
  }

  return packagePath.slice(0, lastIndex)
}

function resolveDependencyType(
  packagePath: string,
  name: string,
  directDependenciesByContext: DirectDependenciesByContext,
) {
  const packageContext = getInstalledPackageContext(packagePath)

  if (packageContext === null) {
    return "unknown" as const
  }

  const directDependencies = directDependenciesByContext.get(packageContext)

  if (directDependencies) {
    return directDependencies.has(name)
      ? ("direct" as const)
      : ("transitive" as const)
  }

  if (packageContext.includes("node_modules/")) {
    return "transitive" as const
  }

  return "unknown" as const
}

export async function parseNodeDependencyFile(
  input: ParseNodeDependencyFileInput,
): Promise<ParseNodeDependencyFileResult> {
  if (input.file.path.endsWith("package-lock.json")) {
    const parsed = JSON.parse(input.content) as PackageLockData
    const directDependencies = collectDeclaredDirectDependencies(parsed)

    const packages = Object.entries(parsed.packages ?? {})
      .filter(([packagePath]) => isInstalledNodePackagePath(packagePath))
      .map(([packagePath, pkg]) => {
        const name = extractNodePackageName(packagePath)

        return {
          ecosystem: "npm" as const,
          name,
          version: pkg.version ?? null,
          versionKind: "resolved" as const,
          dependencyType: resolveDependencyType(
            packagePath,
            name,
            directDependencies,
          ),
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
      versionKind: "declared" as const,
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
