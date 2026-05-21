import { describe, expect, expectTypeOf, it } from "vitest"

import type {
  CheckProjectDependenciesInput,
  CheckProjectDependenciesResult,
  DiscoverDependencyFilesInput,
  DiscoverDependencyFilesResult,
  DetectedDependencyFile,
  ResolvedDependency,
  ScanDependenciesInput,
  ScanDependenciesResult,
} from "../packages/content/src/project-security/types"
import { checkProjectDependenciesAgainstLocalDb } from "../packages/content/src/project-security/check-project"
import { discoverDependencyFiles } from "../packages/content/src/project-security/discover-dependency-files"
import { scanDependencies } from "../packages/content/src/project-security/scan-dependencies"
import * as content from "../packages/content/src"

describe("project-security exports", () => {
  it("re-exports the dependency parser modules from the package root", () => {
    expect(content.discoverDependencyFiles).toBe(discoverDependencyFiles)
    expect(content.scanDependencies).toBe(scanDependencies)
    expect(content.checkProjectDependenciesAgainstLocalDb).toBe(
      checkProjectDependenciesAgainstLocalDb,
    )
  })
})

describe("project-security types", () => {
  it("locks the public parser type contracts", () => {
    expectTypeOf<DiscoverDependencyFilesInput>().toEqualTypeOf<{
      rootDir: string
    }>()

    expectTypeOf<DetectedDependencyFile>().toEqualTypeOf<{
      ecosystem: "npm" | "pypi" | "go" | "crates-io"
      kind: "lockfile" | "manifest"
      path: string
      confidence: "high" | "medium" | "low"
      note: string
    }>()

    expectTypeOf<ResolvedDependency>().toEqualTypeOf<{
      ecosystem: "npm" | "pypi" | "go" | "crates-io"
      name: string
      version: string | null
      dependencyType: "direct" | "transitive" | "unknown"
      sourcePath: string
      sourceKind: "lockfile" | "manifest"
      confidence: "high" | "medium" | "low"
      note: string
    }>()

    expectTypeOf<DiscoverDependencyFilesResult>().toEqualTypeOf<{
      files: DetectedDependencyFile[]
      warnings: string[]
    }>()

    expectTypeOf<ScanDependenciesInput>().toEqualTypeOf<{
      rootDir: string
    }>()

    expectTypeOf<ScanDependenciesResult>().toEqualTypeOf<{
      files: DetectedDependencyFile[]
      packages: ResolvedDependency[]
      warnings: string[]
    }>()

    expectTypeOf<CheckProjectDependenciesInput>().toEqualTypeOf<{
      rootDir: string
    }>()

    expectTypeOf(discoverDependencyFiles).parameters.toEqualTypeOf<
      [DiscoverDependencyFilesInput]
    >()
    expectTypeOf(discoverDependencyFiles).returns.toEqualTypeOf<
      Promise<DiscoverDependencyFilesResult>
    >()

    expectTypeOf(scanDependencies).parameters.toEqualTypeOf<
      [ScanDependenciesInput]
    >()
    expectTypeOf(scanDependencies).returns.toEqualTypeOf<
      Promise<ScanDependenciesResult>
    >()

    expectTypeOf(checkProjectDependenciesAgainstLocalDb).parameters.toMatchTypeOf<
      [unknown, CheckProjectDependenciesInput]
    >()
    expectTypeOf(checkProjectDependenciesAgainstLocalDb).returns.toEqualTypeOf<
      Promise<CheckProjectDependenciesResult>
    >()

    expect(true).toBe(true)
  })
})
