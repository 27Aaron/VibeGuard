import type { SecurityPackageEcosystem } from "@vibeguard/shared"

export type DependencyFileKind = "lockfile" | "manifest"
export type DependencyParseConfidence = "high" | "medium" | "low"
export type DependencyNodeKind = "direct" | "transitive" | "unknown"

export type DetectedDependencyFile = {
  ecosystem: SecurityPackageEcosystem
  kind: DependencyFileKind
  path: string
  confidence: DependencyParseConfidence
  note: string
}

export type DiscoverDependencyFilesInput = {
  rootDir: string
}

export type DiscoverDependencyFilesResult = {
  files: DetectedDependencyFile[]
  warnings: string[]
}

export type ResolvedDependency = {
  ecosystem: SecurityPackageEcosystem
  name: string
  version: string | null
  dependencyType: DependencyNodeKind
  sourcePath: string
  sourceKind: DependencyFileKind
  confidence: DependencyParseConfidence
  note: string
}

export type ScanDependenciesResult = {
  files: DetectedDependencyFile[]
  packages: ResolvedDependency[]
  warnings: string[]
}
