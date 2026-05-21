import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import type { schema } from "@vibeguard/db"
import type { SecurityPackageEcosystem } from "@vibeguard/shared"

import type { checkPackagesAgainstLocalDb } from "../osv/query"

export type DependencyFileKind = "lockfile" | "manifest"
export type DependencyParseConfidence = "high" | "medium" | "low"
export type DependencyNodeKind = "direct" | "transitive" | "unknown"
export type DependencyVersionKind = "resolved" | "declared" | "observed"
export type ProjectSecurityDb = NodePgDatabase<typeof schema>

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
  versionKind: DependencyVersionKind
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

export type ScanDependenciesInput = {
  rootDir: string
}

export type PackageCheckResult = Awaited<
  ReturnType<typeof checkPackagesAgainstLocalDb>
>

export type CheckProjectDependenciesInput = {
  rootDir: string
}

export type CheckProjectDependenciesResult = {
  meta: PackageCheckResult["meta"]
  files: ScanDependenciesResult["files"]
  dependencies: ScanDependenciesResult["packages"]
  warnings: ScanDependenciesResult["warnings"]
  findings: PackageCheckResult["findings"]
}
