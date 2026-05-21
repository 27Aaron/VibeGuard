import { describe, expect, it, vi } from "vitest"

import { checkProjectDependenciesAgainstLocalDb } from "../packages/content/src/project-security/check-project"

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
          dependencyType: "direct",
          sourcePath: "package-lock.json",
          sourceKind: "lockfile",
          confidence: "high",
          note: "resolved from package-lock.json",
        },
        {
          ecosystem: "go",
          name: "example.com/mod",
          version: null,
          dependencyType: "unknown",
          sourcePath: "go.sum",
          sourceKind: "lockfile",
          confidence: "low",
          note: "detected without a reliable installed version",
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
          dependencyType: "direct",
          sourcePath: "package-lock.json",
          sourceKind: "lockfile",
          confidence: "high",
          note: "resolved from package-lock.json",
        },
        {
          ecosystem: "go",
          name: "example.com/mod",
          version: null,
          dependencyType: "unknown",
          sourcePath: "go.sum",
          sourceKind: "lockfile",
          confidence: "low",
          note: "detected without a reliable installed version",
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
})
