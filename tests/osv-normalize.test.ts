import { describe, expect, it } from "vitest"

import {
  normalizeOsvRecord,
  normalizeOsvPackageEcosystem,
  normalizeOsvPackageKey,
} from "../packages/content/src/osv/normalize"

describe("normalizeOsvRecord", () => {
  it("extracts source metadata without retaining raw JSON", () => {
    const result = normalizeOsvRecord(
      {
        schema_version: "1.7.5",
        id: "MAL-2026-4230",
        published: "2026-05-21T21:15:38Z",
        modified: "2026-05-21T23:01:37.118219322Z",
        summary: "Malicious code in cryptoco-auth (npm)",
        details: "The package shipped malicious install behavior.",
        affected: [
          {
            package: {
              name: "cryptoco-auth",
              ecosystem: "npm",
              purl: "pkg:npm/cryptoco-auth",
            },
            versions: ["1.0.0", "1.0.1"],
          },
        ],
      },
      {
        sourceUrl:
          "https://storage.googleapis.com/osv-vulnerabilities/npm/MAL-2026-4230.json",
        dumpEcosystems: ["npm"],
        rawHash: "sha256:test",
        rawSizeBytes: 1499,
        syncedAt: new Date("2026-05-22T00:00:00Z"),
      },
    )

    expect(result.sourceRecord).toMatchObject({
      source: "osv",
      externalId: "MAL-2026-4230",
      sourceUrl:
        "https://storage.googleapis.com/osv-vulnerabilities/npm/MAL-2026-4230.json",
      schemaVersion: "1.7.5",
      rawHash: "sha256:test",
      rawSizeBytes: 1499,
      parseStatus: "parsed",
    })
    expect(result.sourceRecord).not.toHaveProperty("rawJson")
    expect(result.advisory.riskType).toBe("malicious-package")
    expect(result.affectedPackages[0]).toMatchObject({
      ecosystem: "npm",
      packageName: "cryptoco-auth",
      packageKey: "cryptoco-auth",
      affectedVersions: ["1.0.0", "1.0.1"],
      fixedVersions: [],
    })
  })

  it("merges repeated affected package ranges and extracts fixed versions", () => {
    const result = normalizeOsvRecord(
      {
        schema_version: "1.7.5",
        id: "GHSA-94jr-7pqp-xhcq",
        modified: "2026-05-21T22:45:09.635035005Z",
        aliases: ["CVE-2026-40938"],
        summary: "Tekton Pipeline git argument injection",
        affected: [
          {
            package: {
              name: "github.com/tektoncd/pipeline",
              ecosystem: "Go",
              purl: "pkg:golang/github.com/tektoncd/pipeline",
            },
            ranges: [
              {
                type: "SEMVER",
                events: [{ introduced: "1.10.0" }, { fixed: "1.11.1" }],
              },
            ],
          },
          {
            package: {
              name: "github.com/tektoncd/pipeline",
              ecosystem: "Go",
              purl: "pkg:golang/github.com/tektoncd/pipeline",
            },
            ranges: [
              {
                type: "SEMVER",
                events: [{ introduced: "1.7.0" }, { fixed: "1.9.3" }],
              },
            ],
          },
        ],
      },
      {
        sourceUrl:
          "https://storage.googleapis.com/osv-vulnerabilities/Go/GHSA-94jr-7pqp-xhcq.json",
        dumpEcosystems: ["Go"],
        rawHash: "sha256:test",
        rawSizeBytes: 9705,
        syncedAt: new Date("2026-05-22T00:00:00Z"),
      },
    )

    expect(result.affectedPackages).toHaveLength(1)
    expect(result.affectedPackages[0]).toMatchObject({
      ecosystem: "go",
      packageKey: "github.com/tektoncd/pipeline",
      fixedVersions: ["1.11.1", "1.9.3"],
    })
    expect(result.affectedPackages[0]?.ranges).toHaveLength(2)
  })
})

describe("OSV package normalization", () => {
  it("normalizes the MVP ecosystems and package keys", () => {
    expect(normalizeOsvPackageEcosystem("npm")).toBe("npm")
    expect(normalizeOsvPackageEcosystem("PyPI")).toBe("pypi")
    expect(normalizeOsvPackageEcosystem("Go")).toBe("go")
    expect(normalizeOsvPackageEcosystem("crates.io")).toBe("crates-io")

    expect(normalizeOsvPackageKey("PyPI", "My_Package.Name")).toBe(
      "my-package-name",
    )
    expect(normalizeOsvPackageKey("npm", "@Scope/Package")).toBe(
      "@scope/package",
    )
  })
})
