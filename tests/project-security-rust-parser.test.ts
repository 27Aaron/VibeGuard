import { describe, expect, it } from "vitest"

import { parseRustDependencyFile } from "../packages/content/src/project-security/parsers/rust"

describe("parseRustDependencyFile", () => {
  it("parses Cargo.lock versions and marks manifest dependencies as direct", async () => {
    const result = await parseRustDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "crates-io",
        kind: "lockfile",
        path: "Cargo.lock",
        confidence: "high",
        note: "lockfile",
      },
      content: [
        "[[package]]",
        'name = "serde"',
        'version = "1.0.217"',
        "",
        "[[package]]",
        'name = "serde_derive"',
        'version = "1.0.217"',
      ].join("\n"),
      manifestContent: [
        "[package]",
        'name = "demo"',
        "",
        "[dependencies]",
        'serde = "1.0"',
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "crates-io",
        name: "serde",
        version: "1.0.217",
        dependencyType: "direct",
        sourcePath: "Cargo.lock",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from Cargo.lock",
      },
      {
        ecosystem: "crates-io",
        name: "serde_derive",
        version: "1.0.217",
        dependencyType: "transitive",
        sourcePath: "Cargo.lock",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from Cargo.lock",
      },
    ])
  })

  it("falls back to Cargo.toml dependencies with medium confidence", async () => {
    const result = await parseRustDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "crates-io",
        kind: "manifest",
        path: "Cargo.toml",
        confidence: "medium",
        note: "manifest",
      },
      content: [
        "[package]",
        'name = "demo"',
        "",
        "[dependencies]",
        'serde = "1.0"',
        'tokio = { version = "1.43.0", features = ["rt-multi-thread"] }',
        "",
        "[dev-dependencies]",
        'insta = "1.42.1"',
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "crates-io",
        name: "insta",
        version: "1.42.1",
        dependencyType: "direct",
        sourcePath: "Cargo.toml",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "crates-io",
        name: "serde",
        version: "1.0",
        dependencyType: "direct",
        sourcePath: "Cargo.toml",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "crates-io",
        name: "tokio",
        version: "1.43.0",
        dependencyType: "direct",
        sourcePath: "Cargo.toml",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
    ])
  })

  it("keeps Cargo.lock dependency type unknown without manifest support", async () => {
    const result = await parseRustDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "crates-io",
        kind: "lockfile",
        path: "Cargo.lock",
        confidence: "high",
        note: "lockfile",
      },
      content: [
        "[[package]]",
        'name = "serde"',
        'version = "1.0.217"',
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "crates-io",
        name: "serde",
        version: "1.0.217",
        dependencyType: "unknown",
        sourcePath: "Cargo.lock",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from Cargo.lock",
      },
    ])
  })

  it("skips the workspace crate when it appears in Cargo.lock and manifest identifies it", async () => {
    const result = await parseRustDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "crates-io",
        kind: "lockfile",
        path: "Cargo.lock",
        confidence: "high",
        note: "lockfile",
      },
      content: [
        "[[package]]",
        'name = "demo"',
        'version = "0.1.0"',
        "",
        "[[package]]",
        'name = "serde"',
        'version = "1.0.217"',
      ].join("\n"),
      manifestContent: [
        "[package]",
        'name = "demo"',
        "",
        "[dependencies]",
        'serde = "1.0"',
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "crates-io",
        name: "serde",
        version: "1.0.217",
        dependencyType: "direct",
        sourcePath: "Cargo.lock",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from Cargo.lock",
      },
    ])
  })
})
