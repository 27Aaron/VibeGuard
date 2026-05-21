import { describe, expect, it } from "vitest"

import { parseNodeDependencyFile } from "../packages/content/src/project-security/parsers/node"

describe("parseNodeDependencyFile", () => {
  it("parses package-lock direct and transitive dependencies", async () => {
    const result = await parseNodeDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "npm",
        kind: "lockfile",
        path: "package-lock.json",
        confidence: "high",
        note: "lockfile",
      },
      content: JSON.stringify({
        name: "demo",
        lockfileVersion: 3,
        packages: {
          "": {
            dependencies: {
              react: "^19.1.0",
            },
          },
          "node_modules/react": {
            version: "19.1.0",
          },
          "node_modules/loose-envify": {
            version: "1.4.0",
          },
        },
      }),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "npm",
        name: "loose-envify",
        version: "1.4.0",
        versionKind: "resolved",
        dependencyType: "transitive",
        sourcePath: "package-lock.json",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from package-lock.json",
      },
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
  })

  it("falls back to package.json with medium confidence", async () => {
    const result = await parseNodeDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "npm",
        kind: "manifest",
        path: "package.json",
        confidence: "medium",
        note: "manifest",
      },
      content: JSON.stringify({
        dependencies: {
          react: "^19.1.0",
        },
        devDependencies: {
          vitest: "^3.2.4",
        },
      }),
    })

    expect(result.warnings).toEqual([])
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
      {
        ecosystem: "npm",
        name: "vitest",
        version: "^3.2.4",
        versionKind: "declared",
        dependencyType: "direct",
        sourcePath: "package.json",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
    ])
  })

  it("marks workspace nested installs as unknown when directness cannot be proven", async () => {
    const result = await parseNodeDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "npm",
        kind: "lockfile",
        path: "package-lock.json",
        confidence: "high",
        note: "lockfile",
      },
      content: JSON.stringify({
        name: "workspace-demo",
        lockfileVersion: 3,
        packages: {
          "": {
            dependencies: {
              react: "^19.1.0",
            },
          },
          "apps/web/node_modules/react": {
            version: "19.1.0",
          },
          "apps/web/node_modules/loose-envify": {
            version: "1.4.0",
          },
          "packages/widget/node_modules/react": {
            version: "19.1.0",
          },
        },
      }),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "npm",
        name: "loose-envify",
        version: "1.4.0",
        versionKind: "resolved",
        dependencyType: "unknown",
        sourcePath: "package-lock.json",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from package-lock.json",
      },
      {
        ecosystem: "npm",
        name: "react",
        version: "19.1.0",
        versionKind: "resolved",
        dependencyType: "unknown",
        sourcePath: "package-lock.json",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from package-lock.json",
      },
      {
        ecosystem: "npm",
        name: "react",
        version: "19.1.0",
        versionKind: "resolved",
        dependencyType: "unknown",
        sourcePath: "package-lock.json",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from package-lock.json",
      },
    ])
  })

  it("treats workspace-declared nested installs as direct dependencies", async () => {
    const result = await parseNodeDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "npm",
        kind: "lockfile",
        path: "package-lock.json",
        confidence: "high",
        note: "lockfile",
      },
      content: JSON.stringify({
        name: "workspace-demo",
        lockfileVersion: 3,
        packages: {
          "": {},
          "apps/web": {
            dependencies: {
              react: "^19.1.0",
            },
          },
          "apps/web/node_modules/react": {
            version: "19.1.0",
          },
          "apps/web/node_modules/loose-envify": {
            version: "1.4.0",
          },
        },
      }),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "npm",
        name: "loose-envify",
        version: "1.4.0",
        versionKind: "resolved",
        dependencyType: "transitive",
        sourcePath: "package-lock.json",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from package-lock.json",
      },
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
  })
})
