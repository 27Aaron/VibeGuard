import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { scanDependencies } from "../packages/content/src/project-security/scan-dependencies"

describe("scanDependencies", () => {
  it("prefers lockfiles, aggregates packages, and preserves warnings", async () => {
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
      fs.writeFileSync(
        path.join(rootDir, "services", "api", "requirements.txt"),
        ["requests==2.32.3", "-r base.txt"].join("\n"),
      )

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
          expect.objectContaining({
            path: "services/api/requirements.txt",
            kind: "manifest",
          }),
        ]),
      )
      expect(result.packages).toEqual([
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
          ecosystem: "pypi",
          name: "requests",
          version: "2.32.3",
          dependencyType: "direct",
          sourcePath: "services/api/requirements.txt",
          sourceKind: "manifest",
          confidence: "medium",
          note: "declared dependency without a lockfile",
        },
      ])
      expect(
        result.packages.find((pkg) => pkg.sourcePath === "package.json"),
      ).toBeUndefined()
      expect(result.warnings).toEqual([
        "Unsupported Python requirement directive in services/api/requirements.txt: -r base.txt",
      ])
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
