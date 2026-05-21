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

  it("warns and skips direct reference requirements instead of treating them as versions", async () => {
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
        "mypkg @ git+https://github.com/example/mypkg.git",
        "localpkg @ file:///tmp/localpkg",
      ].join("\n"),
    })

    expect(result.packages).toEqual([])
    expect(result.warnings).toEqual([
      "Unsupported Python direct reference in requirements.txt: mypkg @ git+https://github.com/example/mypkg.git",
      "Unsupported Python direct reference in requirements.txt: localpkg @ file:///tmp/localpkg",
    ])
  })

  it("warns and skips plain-url direct references in requirements.txt", async () => {
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
        "remotepkg @ https://example.com/packages/remotepkg-1.0.0.tar.gz",
        "sshpkg @ ssh://git@example.com/repo.git",
        "httppkg @ http://example.com/httppkg.whl",
      ].join("\n"),
    })

    expect(result.packages).toEqual([])
    expect(result.warnings).toEqual([
      "Unsupported Python direct reference in requirements.txt: remotepkg @ https://example.com/packages/remotepkg-1.0.0.tar.gz",
      "Unsupported Python direct reference in requirements.txt: sshpkg @ ssh://git@example.com/repo.git",
      "Unsupported Python direct reference in requirements.txt: httppkg @ http://example.com/httppkg.whl",
    ])
  })

  it("parses pyproject.toml dependency declarations with medium confidence", async () => {
    const result = await parsePythonDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "pypi",
        kind: "manifest",
        path: "pyproject.toml",
        confidence: "medium",
        note: "manifest",
      },
      content: [
        "[project]",
        'dependencies = ["requests>=2.32.3", "rich"]',
        "",
        "[tool.poetry.dependencies]",
        'python = "^3.12"',
        'fastapi = "^0.115.0"',
        'uvicorn = { version = "0.34.0", extras = ["standard"] }',
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "pypi",
        name: "fastapi",
        version: "^0.115.0",
        dependencyType: "direct",
        sourcePath: "pyproject.toml",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "pypi",
        name: "requests",
        version: ">=2.32.3",
        dependencyType: "direct",
        sourcePath: "pyproject.toml",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "pypi",
        name: "rich",
        version: null,
        dependencyType: "direct",
        sourcePath: "pyproject.toml",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
      {
        ecosystem: "pypi",
        name: "uvicorn",
        version: "0.34.0",
        dependencyType: "direct",
        sourcePath: "pyproject.toml",
        sourceKind: "manifest",
        confidence: "medium",
        note: "declared dependency without a lockfile",
      },
    ])
  })

  it("warns and skips non-version poetry dependency sources", async () => {
    const result = await parsePythonDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "pypi",
        kind: "manifest",
        path: "pyproject.toml",
        confidence: "medium",
        note: "manifest",
      },
      content: [
        "[tool.poetry.dependencies]",
        'python = "^3.12"',
        'local-lib = { path = "../lib" }',
        'git-lib = { git = "https://github.com/example/repo.git" }',
        'url-lib = { url = "https://example.com/url-lib.whl" }',
      ].join("\n"),
    })

    expect(result.packages).toEqual([])
    expect(result.warnings).toEqual([
      'Unsupported Python source dependency in pyproject.toml: local-lib = { path = "../lib" }',
      'Unsupported Python source dependency in pyproject.toml: git-lib = { git = "https://github.com/example/repo.git" }',
      'Unsupported Python source dependency in pyproject.toml: url-lib = { url = "https://example.com/url-lib.whl" }',
    ])
  })

  it("parses poetry.lock package entries conservatively", async () => {
    const result = await parsePythonDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "pypi",
        kind: "lockfile",
        path: "poetry.lock",
        confidence: "high",
        note: "lockfile",
      },
      content: [
        "[[package]]",
        'name = "requests"',
        'version = "2.32.3"',
        "",
        "[[package]]",
        'name = "urllib3"',
        'version = "2.2.2"',
      ].join("\n"),
    })

    expect(result.warnings).toEqual([])
    expect(result.packages).toEqual([
      {
        ecosystem: "pypi",
        name: "requests",
        version: "2.32.3",
        dependencyType: "unknown",
        sourcePath: "poetry.lock",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from poetry.lock",
      },
      {
        ecosystem: "pypi",
        name: "urllib3",
        version: "2.2.2",
        dependencyType: "unknown",
        sourcePath: "poetry.lock",
        sourceKind: "lockfile",
        confidence: "high",
        note: "resolved from poetry.lock",
      },
    ])
  })

  it("still warns on unsupported Python file types outside the safe subset", async () => {
    const result = await parsePythonDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "pypi",
        kind: "manifest",
        path: "setup.py",
        confidence: "medium",
        note: "manifest",
      },
      content: "install_requires=['requests']",
    })

    expect(result.packages).toEqual([])
    expect(result.warnings).toEqual([
      "Unsupported Python dependency file for Task 4 parser: setup.py",
    ])
  })
})
