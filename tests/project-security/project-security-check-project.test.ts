import { describe, expect, it, vi } from "vitest"

import { checkProjectDependenciesAgainstLocalDb } from "../../packages/content/src/project-security/check-project"

describe("checkProjectDependenciesAgainstLocalDb", () => {
  it("scans a project and forwards normalized package coordinates to the local OSV checker", async () => {
    const scanDependencies = vi.fn().mockResolvedValue({
      files: [
        {
          ecosystem: "npm",
          kind: "lockfile",
          path: "package-lock.json",
          confidence: "high",
          note: "lockfile",
        },
      ],
      warnings: ["manifest fallback skipped"],
      packages: [
        {
          ecosystem: "npm",
          name: "react",
          version: "19.1.0",
          versionKind: "resolved",
          dependencyType: "direct",
          sourcePath: "package-lock.json",
          sourceKind: "lockfile",
          confidence: "high",
          note: "resolved from package-lock.json",
        },
        {
          ecosystem: "go",
          name: "example.com/mod",
          version: "v1.1.0",
          versionKind: "observed",
          dependencyType: "unknown",
          sourcePath: "go.sum",
          sourceKind: "lockfile",
          confidence: "low",
          note: "Go checksum entry observed without proving it is in the active dependency graph",
        },
      ],
    })
    const checkPackagesAgainstLocalDb = vi.fn().mockResolvedValue({
      meta: {
        source: "local-osv-mirror",
        stale: false,
        warning: null,
        lastSyncedAt: null,
      },
      findings: [
        {
          affected: true,
          confidence: "high",
          matchReason: "explicit_affected_version",
          matchSummary:
            "react@19.1.0 is explicitly listed as affected in the local OSV advisory data.",
          package: {
            ecosystem: "npm",
            name: "react",
            version: "19.1.0",
            purl: "pkg:npm/react",
          },
          advisory: {
            id: "GHSA-test",
            source: "osv",
            riskType: "vulnerability",
            summary: "React test advisory",
            details: null,
            aliases: [],
            severity: [],
            references: [],
            modifiedAt: "2026-05-22T00:00:00.000Z",
          },
          affectedPackage: {
            affectedVersions: ["19.1.0"],
            ranges: [],
            fixedVersions: ["19.1.1"],
          },
        },
      ],
    })

    const result = await checkProjectDependenciesAgainstLocalDb(
      {} as never,
      { rootDir: "/repo" },
      { scanDependencies, checkPackagesAgainstLocalDb },
    )

    expect(scanDependencies).toHaveBeenCalledWith({ rootDir: "/repo" })
    expect(checkPackagesAgainstLocalDb).toHaveBeenCalledWith(
      {} as never,
      {
        packages: [
          { ecosystem: "npm", name: "react", version: "19.1.0" },
          { ecosystem: "go", name: "example.com/mod", version: null },
        ],
      },
    )
    expect(result).toEqual({
      meta: {
        source: "local-osv-mirror",
        stale: false,
        warning: null,
        lastSyncedAt: null,
      },
      files: [
        {
          ecosystem: "npm",
          kind: "lockfile",
          path: "package-lock.json",
          confidence: "high",
          note: "lockfile",
        },
      ],
      dependencies: [
        {
          ecosystem: "npm",
          name: "react",
          version: "19.1.0",
          versionKind: "resolved",
          dependencyType: "direct",
          sourcePath: "package-lock.json",
          sourceKind: "lockfile",
          confidence: "high",
          note: "resolved from package-lock.json",
        },
        {
          ecosystem: "go",
          name: "example.com/mod",
          version: "v1.1.0",
          versionKind: "observed",
          dependencyType: "unknown",
          sourcePath: "go.sum",
          sourceKind: "lockfile",
          confidence: "low",
          note: "Go checksum entry observed without proving it is in the active dependency graph",
        },
      ],
      warnings: ["manifest fallback skipped"],
      findings: [
        {
          affected: true,
          confidence: "high",
          matchReason: "explicit_affected_version",
          matchSummary:
            "react@19.1.0 is explicitly listed as affected in the local OSV advisory data.",
          package: {
            ecosystem: "npm",
            name: "react",
            version: "19.1.0",
            purl: "pkg:npm/react",
          },
          advisory: {
            id: "GHSA-test",
            source: "osv",
            riskType: "vulnerability",
            summary: "React test advisory",
            details: null,
            aliases: [],
            severity: [],
            references: [],
            modifiedAt: "2026-05-22T00:00:00.000Z",
          },
          affectedPackage: {
            affectedVersions: ["19.1.0"],
            ranges: [],
            fixedVersions: ["19.1.1"],
          },
        },
      ],
    })
  })

  it("dedupes forwarded lookup coordinates while preserving the original dependency list", async () => {
    const duplicateReact = {
      ecosystem: "npm" as const,
      name: "react",
      version: "19.1.0",
      versionKind: "resolved" as const,
      dependencyType: "direct" as const,
      sourcePath: "package-lock.json",
      sourceKind: "lockfile" as const,
      confidence: "high" as const,
      note: "resolved from package-lock.json",
    }
    const duplicateGo = {
      ecosystem: "go" as const,
      name: "example.com/mod",
      version: null,
      versionKind: "observed" as const,
      dependencyType: "unknown" as const,
      sourcePath: "go.sum",
      sourceKind: "lockfile" as const,
      confidence: "low" as const,
      note: "Go checksum entry observed without proving it is in the active dependency graph",
    }
    const scanDependencies = vi.fn().mockResolvedValue({
      files: [],
      warnings: [],
      packages: [
        duplicateReact,
        { ...duplicateReact, dependencyType: "transitive" as const },
        duplicateGo,
        { ...duplicateGo },
      ],
    })
    const checkPackagesAgainstLocalDb = vi.fn().mockResolvedValue({
      meta: {
        source: "local-osv-mirror",
        stale: false,
        warning: null,
        lastSyncedAt: null,
      },
      findings: [],
    })

    const result = await checkProjectDependenciesAgainstLocalDb(
      {} as never,
      { rootDir: "/repo" },
      { scanDependencies, checkPackagesAgainstLocalDb },
    )

    expect(checkPackagesAgainstLocalDb).toHaveBeenCalledWith(
      {} as never,
      {
        packages: [
          { ecosystem: "npm", name: "react", version: "19.1.0" },
          { ecosystem: "go", name: "example.com/mod", version: null },
        ],
      },
    )
    expect(result.dependencies).toEqual([
      duplicateReact,
      { ...duplicateReact, dependencyType: "transitive" },
      duplicateGo,
      { ...duplicateGo },
    ])
  })

  it("dedupes alias-equivalent package names using OSV lookup normalization rules", async () => {
    const requestsUpper = {
      ecosystem: "pypi" as const,
      name: "Requests",
      version: "2.32.3",
      dependencyType: "direct" as const,
      sourcePath: "requirements.txt",
      sourceKind: "manifest" as const,
      confidence: "medium" as const,
      note: "declared dependency without a lockfile",
      versionKind: "declared" as const,
    }
    const requestsNormalized = {
      ...requestsUpper,
      name: "requests",
    }
    const myPkgUnderscore = {
      ecosystem: "pypi" as const,
      name: "my_pkg",
      version: "1.0.0",
      dependencyType: "direct" as const,
      sourcePath: "requirements.txt",
      sourceKind: "manifest" as const,
      confidence: "medium" as const,
      note: "declared dependency without a lockfile",
      versionKind: "declared" as const,
    }
    const myPkgHyphen = {
      ...myPkgUnderscore,
      name: "my-pkg",
    }
    const scanDependencies = vi.fn().mockResolvedValue({
      files: [],
      warnings: [],
      packages: [
        requestsUpper,
        requestsNormalized,
        myPkgUnderscore,
        myPkgHyphen,
      ],
    })
    const checkPackagesAgainstLocalDb = vi.fn().mockResolvedValue({
      meta: {
        source: "local-osv-mirror",
        stale: false,
        warning: null,
        lastSyncedAt: null,
      },
      findings: [],
    })

    const result = await checkProjectDependenciesAgainstLocalDb(
      {} as never,
      { rootDir: "/repo" },
      { scanDependencies, checkPackagesAgainstLocalDb },
    )

    expect(checkPackagesAgainstLocalDb).toHaveBeenCalledWith(
      {} as never,
      {
        packages: [
          { ecosystem: "pypi", name: "Requests", version: null },
          { ecosystem: "pypi", name: "my_pkg", version: null },
        ],
      },
    )
    expect(result.dependencies).toEqual([
      requestsUpper,
      requestsNormalized,
      myPkgUnderscore,
      myPkgHyphen,
    ])
  })
})
