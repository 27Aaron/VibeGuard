import { describe, expect, it } from "vitest"

import type {
  DiscoverDependencyFilesInput,
  DiscoverDependencyFilesResult,
  DetectedDependencyFile,
  ResolvedDependency,
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
  it("keeps the parser result shape stable", () => {
    const discoverInput: DiscoverDependencyFilesInput = {
      rootDir: "/tmp/project",
    }

    const file: DetectedDependencyFile = {
      ecosystem: "npm",
      kind: "lockfile",
      path: "package-lock.json",
      confidence: "high",
      note: "locked dependency file",
    }

    const pkg: ResolvedDependency = {
      ecosystem: "npm",
      name: "react",
      version: "19.1.0",
      dependencyType: "direct",
      sourcePath: "package-lock.json",
      sourceKind: "lockfile",
      confidence: "high",
      note: "explicit installed dependency",
    }

    const discovered: DiscoverDependencyFilesResult = {
      files: [file],
      warnings: [],
    }

    const result: ScanDependenciesResult = {
      files: discovered.files,
      packages: [pkg],
      warnings: discovered.warnings,
    }

    expect(discoverInput.rootDir).toBe("/tmp/project")
    expect(discovered.files[0]?.path).toBe("package-lock.json")
    expect(result.packages[0]?.name).toBe("react")
  })
})
