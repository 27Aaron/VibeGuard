import fs from "node:fs"
import os from "node:os"
import path from "node:path"

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

describe("discoverDependencyFiles", () => {
  it("finds supported files, skips ignored directories, and keeps relative paths", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-discovery-"))

    try {
      fs.writeFileSync(path.join(rootDir, "package-lock.json"), "{}")
      fs.writeFileSync(path.join(rootDir, "package.json"), "{}")
      fs.mkdirSync(path.join(rootDir, "services", "api"), { recursive: true })
      fs.writeFileSync(
        path.join(rootDir, "services", "api", "requirements.txt"),
        "requests==2.32.3\n",
      )
      fs.mkdirSync(path.join(rootDir, "node_modules"), { recursive: true })
      fs.writeFileSync(
        path.join(rootDir, "node_modules", "package-lock.json"),
        "{}",
      )

      const result = await discoverDependencyFiles({ rootDir })

      expect(result.files).toEqual([
        {
          ecosystem: "npm",
          kind: "lockfile",
          path: "package-lock.json",
          confidence: "high",
          note: "lockfile discovered during recursive scan",
        },
        {
          ecosystem: "npm",
          kind: "manifest",
          path: "package.json",
          confidence: "medium",
          note: "manifest discovered during recursive scan",
        },
        {
          ecosystem: "pypi",
          kind: "manifest",
          path: "services/api/requirements.txt",
          confidence: "medium",
          note: "manifest discovered during recursive scan",
        },
      ])
      expect(result.warnings).toEqual([])
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("fails fast when dependency file traversal cannot complete", async () => {
    const rootDir = path.join(
      os.tmpdir(),
      `vg-discovery-missing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )

    await expect(discoverDependencyFiles({ rootDir })).rejects.toThrow()
  })
})
