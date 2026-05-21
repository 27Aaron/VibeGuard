import { describe, expect, it } from "vitest"

import type {
  DetectedDependencyFile,
  ResolvedDependency,
  ScanDependenciesResult,
} from "../packages/content/src/project-security/types"
import * as content from "../packages/content/src"

describe("project-security exports", () => {
  it("exports the dependency parser surface from the package root", () => {
    expect(content).toHaveProperty("discoverDependencyFiles")
    expect(content).toHaveProperty("scanDependencies")
    expect(content).toHaveProperty("checkProjectDependenciesAgainstLocalDb")
  })
})

describe("project-security types", () => {
  it("keeps the parser result shape stable", () => {
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

    const result: ScanDependenciesResult = {
      files: [file],
      packages: [pkg],
      warnings: [],
    }

    expect(result.packages[0]?.name).toBe("react")
  })
})
