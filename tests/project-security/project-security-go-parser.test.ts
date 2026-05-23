import { describe, expect, it } from "vitest"

import { parseGoDependencyFile } from "../../packages/content/src/project-security/parsers/go"

describe("parseGoDependencyFile", () => {
  it("parses go.sum versions and keeps dependency type honest", async () => {
    const result = await parseGoDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "go",
        kind: "lockfile",
        path: "go.sum",
        confidence: "high",
        note: "go sum",
      },
      content: [
        "github.com/pkg/errors v0.9.1 h1:abc",
        "github.com/pkg/errors v0.9.1/go.mod h1:def",
        "golang.org/x/text v0.21.0 h1:ghi",
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "go",
        name: "github.com/pkg/errors",
        version: "v0.9.1",
        versionKind: "observed",
        dependencyType: "unknown",
        sourcePath: "go.sum",
        sourceKind: "lockfile",
        confidence: "low",
        note: "Go checksum entry observed without proving it is in the active dependency graph",
      },
      {
        ecosystem: "go",
        name: "golang.org/x/text",
        version: "v0.21.0",
        versionKind: "observed",
        dependencyType: "unknown",
        sourcePath: "go.sum",
        sourceKind: "lockfile",
        confidence: "low",
        note: "Go checksum entry observed without proving it is in the active dependency graph",
      },
    ])
  })

  it("falls back to go.mod requires with medium confidence", async () => {
    const result = await parseGoDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "go",
        kind: "manifest",
        path: "go.mod",
        confidence: "medium",
        note: "manifest",
      },
      content: [
        "module example.com/demo",
        "",
        "go 1.24.0",
        "",
        "require (",
        "\tgithub.com/gin-gonic/gin v1.10.0",
        "\tgolang.org/x/text v0.21.0 // indirect",
        ")",
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "go",
        name: "github.com/gin-gonic/gin",
        version: "v1.10.0",
        versionKind: "declared",
        dependencyType: "direct",
        sourcePath: "go.mod",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "go",
        name: "golang.org/x/text",
        version: "v0.21.0",
        versionKind: "declared",
        dependencyType: "transitive",
        sourcePath: "go.mod",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
    ])
  })

  it("keeps go.sum historical versions as low-confidence observations", async () => {
    const result = await parseGoDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "go",
        kind: "lockfile",
        path: "go.sum",
        confidence: "high",
        note: "go sum",
      },
      content: [
        "example.com/mod v1.0.0 h1:old",
        "example.com/mod v1.1.0 h1:new",
      ].join("\n"),
    })

    expect(result.packages).toEqual([
      {
        ecosystem: "go",
        name: "example.com/mod",
        version: "v1.0.0",
        versionKind: "observed",
        dependencyType: "unknown",
        sourcePath: "go.sum",
        sourceKind: "lockfile",
        confidence: "low",
        note: "Go checksum entry observed without proving it is in the active dependency graph",
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
    ])
  })
})
