import { describe, expect, it } from "vitest"

import { parsePythonDependencyFile } from "../packages/content/src/project-security/parsers/python"

describe("parsePythonDependencyFile", () => {
  it("parses requirements.txt pins and ranges as direct dependencies", async () => {
    const result = await parsePythonDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "pypi",
        kind: "manifest",
        path: "requirements.txt",
        confidence: "medium",
        note: "requirements",
      },
      content: [
        "# comment",
        "requests==2.32.3",
        "urllib3>=2.2.0",
        "rich",
        "fastapi[all]==0.115.0 ; python_version >= '3.10'",
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "pypi",
        name: "fastapi",
        version: "0.115.0",
        dependencyType: "direct",
        sourcePath: "requirements.txt",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "pypi",
        name: "requests",
        version: "2.32.3",
        dependencyType: "direct",
        sourcePath: "requirements.txt",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "pypi",
        name: "rich",
        version: null,
        dependencyType: "direct",
        sourcePath: "requirements.txt",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "pypi",
        name: "urllib3",
        version: ">=2.2.0",
        dependencyType: "direct",
        sourcePath: "requirements.txt",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
    ])
  })

  it("warns on unsupported include directives without inventing dependencies", async () => {
    const result = await parsePythonDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "pypi",
        kind: "manifest",
        path: "requirements.txt",
        confidence: "medium",
        note: "requirements",
      },
      content: ["-r base.txt", "--index-url https://example.com/simple"].join(
        "\n",
      ),
    })

    expect(result.packages).toEqual([])
    expect(result.warnings).toEqual([
      "Unsupported Python requirement directive in requirements.txt: -r base.txt",
      "Unsupported Python requirement directive in requirements.txt: --index-url https://example.com/simple",
    ])
  })
})
