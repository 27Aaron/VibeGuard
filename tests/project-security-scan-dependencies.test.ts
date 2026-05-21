import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { scanDependencies } from "../packages/content/src/project-security/scan-dependencies"

describe("scanDependencies", () => {
  it("prefers a Node lockfile over package.json in the same directory", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-scan-"))

    try {
      fs.writeFileSync(
        path.join(rootDir, "package-lock.json"),
        JSON.stringify({
          packages: {
            "": { dependencies: { react: "^19.1.0" } },
            "node_modules/react": { version: "19.1.0" },
          },
        }),
      )
      fs.writeFileSync(
        path.join(rootDir, "package.json"),
        JSON.stringify({ dependencies: { react: "^19.1.0" } }),
      )
      fs.mkdirSync(path.join(rootDir, "services", "api"), { recursive: true })

      const result = await scanDependencies({ rootDir })

      expect(result.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "package-lock.json",
            kind: "lockfile",
          }),
          expect.objectContaining({
            path: "package.json",
            kind: "manifest",
          }),
        ]),
      )
      expect(result.packages).toEqual([
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
      ])
      expect(
        result.packages.find((pkg) => pkg.sourcePath === "package.json"),
      ).toBeUndefined()
      expect(result.warnings).toEqual([])
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("keeps Python manifest context alongside a sibling lockfile", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-scan-python-"))

    try {
      fs.writeFileSync(
        path.join(rootDir, "poetry.lock"),
        ['[[package]]', 'name = "requests"', 'version = "2.32.3"'].join("\n"),
      )
      fs.writeFileSync(
        path.join(rootDir, "pyproject.toml"),
        [
          "[tool.poetry.dependencies]",
          'python = "^3.12"',
          'requests = "^2.32.3"',
          'git-lib = { git = "https://github.com/example/repo.git" }',
        ].join("\n"),
      )

      const result = await scanDependencies({ rootDir })

      expect(result.packages).toEqual([
        {
          ecosystem: "pypi",
          name: "requests",
          version: "2.32.3",
          versionKind: "resolved",
          dependencyType: "unknown",
          sourcePath: "poetry.lock",
          sourceKind: "lockfile",
          confidence: "high",
          note: "resolved from poetry.lock",
        },
        {
          ecosystem: "pypi",
          name: "requests",
          version: "^2.32.3",
          versionKind: "declared",
          dependencyType: "direct",
          sourcePath: "pyproject.toml",
          sourceKind: "manifest",
          confidence: "medium",
          note: "declared dependency without a lockfile",
        },
      ])
      expect(result.warnings).toEqual([
        'Unsupported Python source dependency in pyproject.toml: git-lib = { git = "https://github.com/example/repo.git" }',
      ])
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("loads sibling Cargo.toml context when parsing Cargo.lock", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-scan-rust-"))

    try {
      fs.writeFileSync(
        path.join(rootDir, "Cargo.lock"),
        [
          "[[package]]",
          'name = "demo"',
          'version = "0.1.0"',
          "",
          "[[package]]",
          'name = "serde"',
          'version = "1.0.217"',
          'source = "registry+https://github.com/rust-lang/crates.io-index"',
        ].join("\n"),
      )
      fs.writeFileSync(
        path.join(rootDir, "Cargo.toml"),
        [
          "[package]",
          'name = "demo"',
          "",
          "[dependencies]",
          'serde = "1.0"',
        ].join("\n"),
      )

      const result = await scanDependencies({ rootDir })

      expect(result.packages).toEqual([
        {
          ecosystem: "crates-io",
          name: "serde",
          version: "1.0.217",
          versionKind: "resolved",
          dependencyType: "direct",
          sourcePath: "Cargo.lock",
          sourceKind: "lockfile",
          confidence: "high",
          note: "resolved from Cargo.lock",
        },
      ])
      expect(result.warnings).toEqual([])
      expect(
        result.packages.find((pkg) => pkg.sourcePath === "Cargo.toml"),
      ).toBeUndefined()
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("turns malformed dependency files into warnings and continues scanning", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-scan-warning-"))

    try {
      fs.writeFileSync(path.join(rootDir, "package-lock.json"), "{not-json")
      fs.writeFileSync(
        path.join(rootDir, "requirements.txt"),
        "requests==2.32.3\n",
      )

      const result = await scanDependencies({ rootDir })

      expect(result.packages).toEqual([
        {
          ecosystem: "pypi",
          name: "requests",
          version: "2.32.3",
          versionKind: "declared",
          dependencyType: "direct",
          sourcePath: "requirements.txt",
          sourceKind: "manifest",
          confidence: "medium",
          note: "declared dependency without a lockfile",
        },
      ])
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain(
        "Failed to scan dependency file package-lock.json:",
      )
      expect(result.warnings[0]).toContain("JSON")
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("falls back to package.json when a sibling Node lockfile cannot be parsed", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-scan-node-fallback-"))

    try {
      fs.writeFileSync(path.join(rootDir, "package-lock.json"), "{not-json")
      fs.writeFileSync(
        path.join(rootDir, "package.json"),
        JSON.stringify({
          dependencies: {
            react: "^19.1.0",
          },
        }),
      )

      const result = await scanDependencies({ rootDir })

      expect(result.packages).toEqual([
        {
          ecosystem: "npm",
          name: "react",
          version: "^19.1.0",
          versionKind: "declared",
          dependencyType: "direct",
          sourcePath: "package.json",
          sourceKind: "manifest",
          confidence: "medium",
          note: "declared dependency without a lockfile",
        },
      ])
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain(
        "Failed to scan dependency file package-lock.json:",
      )
      expect(result.warnings[0]).toContain("JSON")
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("does not suppress package.json when a sibling npm lockfile is unsupported", async () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "vg-scan-node-unsupported-lockfile-"),
    )

    try {
      fs.writeFileSync(
        path.join(rootDir, "pnpm-lock.yaml"),
        "lockfileVersion: '9.0'\n",
      )
      fs.writeFileSync(
        path.join(rootDir, "package.json"),
        JSON.stringify({
          dependencies: {
            react: "^19.1.0",
          },
        }),
      )

      const result = await scanDependencies({ rootDir })

      expect(result.packages).toEqual([
        {
          ecosystem: "npm",
          name: "react",
          version: "^19.1.0",
          versionKind: "declared",
          dependencyType: "direct",
          sourcePath: "package.json",
          sourceKind: "manifest",
          confidence: "medium",
          note: "declared dependency without a lockfile",
        },
      ])
      expect(result.warnings).toEqual([
        "Unsupported Node file: pnpm-lock.yaml",
      ])
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("falls back to Cargo.toml when a sibling Rust lockfile cannot be parsed", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-scan-rust-fallback-"))

    try {
      fs.writeFileSync(
        path.join(rootDir, "Cargo.lock"),
        ['[[package]]', 'name = "serde"', 'version = "1.0.217"'].join("\n"),
      )
      fs.chmodSync(path.join(rootDir, "Cargo.lock"), 0o000)
      fs.writeFileSync(
        path.join(rootDir, "Cargo.toml"),
        [
          "[package]",
          'name = "demo"',
          "",
          "[dependencies]",
          'serde = "1.0"',
        ].join("\n"),
      )

      const result = await scanDependencies({ rootDir })

      expect(result.packages).toEqual([
        {
          ecosystem: "crates-io",
          name: "serde",
          version: "1.0",
          versionKind: "declared",
          dependencyType: "direct",
          sourcePath: "Cargo.toml",
          sourceKind: "manifest",
          confidence: "medium",
          note: "declared dependency without a lockfile",
        },
      ])
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain(
        "Failed to scan dependency file Cargo.lock:",
      )
    } finally {
      const lockPath = path.join(rootDir, "Cargo.lock")
      if (fs.existsSync(lockPath)) {
        fs.chmodSync(lockPath, 0o644)
      }
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
