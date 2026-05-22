import type { DetectedDependencyFile, ResolvedDependency } from "../types"
import { toSortedPackages } from "./shared"

type ParsePythonDependencyFileInput = {
  rootDir: string
  file: DetectedDependencyFile
  content: string
}

type ParsePythonDependencyFileResult = {
  packages: ResolvedDependency[]
  warnings: string[]
}

function stripPythonRequirementMetadata(line: string) {
  return line.split(";")[0]?.trim() ?? ""
}

function normalizePythonVersion(rawVersion: string | null) {
  if (!rawVersion) {
    return null
  }

  const trimmedVersion = rawVersion.trim()
  if (!trimmedVersion) {
    return null
  }

  if (trimmedVersion.startsWith("===")) {
    return trimmedVersion.slice(3) || null
  }

  if (trimmedVersion.startsWith("==")) {
    return trimmedVersion.slice(2) || null
  }

  return trimmedVersion
}

function parsePythonRequirementLine(line: string) {
  const normalizedLine = stripPythonRequirementMetadata(line)
  const match = normalizedLine.match(
    /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*(.*)$/,
  )

  if (!match?.[1]) {
    return null
  }

  return {
    name: match[1],
    version: normalizePythonVersion(match[2]?.trim() || null),
  }
}

function isSupportedPythonDependencyFile(filePath: string) {
  return (
    filePath.endsWith("requirements.txt") ||
    filePath.endsWith("pyproject.toml") ||
    filePath.endsWith("poetry.lock")
  )
}

function isPythonDirectReference(line: string) {
  return /\s@\s(?:[A-Za-z][A-Za-z0-9+.-]*:)/.test(line)
}

function isPythonSourceDependencyTable(definition: string) {
  return (
    definition.startsWith("{") &&
    /\b(?:path|git|url)\s*=/.test(definition)
  )
}

function buildDeclaredPythonDependency(
  file: DetectedDependencyFile,
  name: string,
  version: string | null,
): ResolvedDependency {
  return {
    ecosystem: "pypi",
    name,
    version,
    versionKind: "declared",
    dependencyType: "direct",
    sourcePath: file.path,
    sourceKind: file.kind,
    confidence: "medium",
    note: "declared dependency without a lockfile",
  }
}

function parsePyprojectArrayEntries(content: string, key: string) {
  const singleLineMatch = content.match(
    new RegExp(`^\\s*${key}\\s*=\\s*\\[(.*)\\]\\s*$`, "m"),
  )
  if (singleLineMatch?.[1]) {
    return [...singleLineMatch[1].matchAll(/"([^"]+)"/g)]
      .map((match) => match[1])
      .filter((entry): entry is string => Boolean(entry))
  }

  const blockMatch = content.match(
    new RegExp(`^\\s*${key}\\s*=\\s*\\[(.*?)^\\s*\\]\\s*$`, "ms"),
  )
  if (!blockMatch?.[1]) {
    return []
  }

  return [...blockMatch[1].matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((entry): entry is string => Boolean(entry))
}

function parsePyprojectDependencies(file: DetectedDependencyFile, content: string) {
  const packages: ResolvedDependency[] = []
  const warnings: string[] = []
  const seen = new Set<string>()

  for (const requirement of parsePyprojectArrayEntries(content, "dependencies")) {
    if (isPythonDirectReference(requirement)) {
      warnings.push(
        `Unsupported Python direct reference in ${file.path}: ${requirement}`,
      )
      continue
    }

    const parsedRequirement = parsePythonRequirementLine(requirement)
    if (!parsedRequirement) {
      warnings.push(`Unsupported Python requirement in ${file.path}: ${requirement}`)
      continue
    }

    const key = `${parsedRequirement.name}@${parsedRequirement.version ?? ""}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    packages.push(
      buildDeclaredPythonDependency(
        file,
        parsedRequirement.name,
        parsedRequirement.version,
      ),
    )
  }

  let currentSection: string | null = null
  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue
    }

    const sectionMatch = trimmedLine.match(/^\[(.+)\]$/)
    if (sectionMatch?.[1]) {
      currentSection = sectionMatch[1]
      continue
    }

    if (currentSection !== "tool.poetry.dependencies") {
      continue
    }

    const dependencyMatch = trimmedLine.match(/^([A-Za-z0-9._-]+)\s*=\s*(.+)$/)
    if (!dependencyMatch?.[1] || !dependencyMatch[2]) {
      continue
    }

    const name = dependencyMatch[1]
    const definition = dependencyMatch[2].trim()

    if (name === "python") {
      continue
    }

    if (isPythonDirectReference(definition)) {
      warnings.push(
        `Unsupported Python direct reference in ${file.path}: ${trimmedLine}`,
      )
      continue
    }

    if (isPythonSourceDependencyTable(definition)) {
      warnings.push(
        `Unsupported Python source dependency in ${file.path}: ${trimmedLine}`,
      )
      continue
    }

    const inlineVersionMatch = definition.match(/^"([^"]+)"$/)
    const tableVersionMatch = definition.match(/version\s*=\s*"([^"]+)"/)
    const version = normalizePythonVersion(
      inlineVersionMatch?.[1] ?? tableVersionMatch?.[1] ?? null,
    )

    const key = `${name}@${version ?? ""}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    packages.push(buildDeclaredPythonDependency(file, name, version))
  }

  return { packages: toSortedPackages(packages), warnings }
}

function parsePoetryLockPackages(file: DetectedDependencyFile, content: string) {
  const packages: ResolvedDependency[] = []
  let currentName: string | null = null
  let currentVersion: string | null = null

  const flushCurrentPackage = () => {
    if (!currentName) {
      return
    }

    packages.push({
      ecosystem: "pypi",
      name: currentName,
      version: currentVersion,
      versionKind: "resolved",
      dependencyType: "unknown",
      sourcePath: file.path,
      sourceKind: file.kind,
      confidence: "high",
      note: "resolved from poetry.lock",
    })
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (trimmedLine === "[[package]]") {
      flushCurrentPackage()
      currentName = null
      currentVersion = null
      continue
    }

    const nameMatch = trimmedLine.match(/^name\s*=\s*"([^"]+)"$/)
    if (nameMatch?.[1]) {
      currentName = nameMatch[1]
      continue
    }

    const versionMatch = trimmedLine.match(/^version\s*=\s*"([^"]+)"$/)
    if (versionMatch?.[1]) {
      currentVersion = versionMatch[1]
    }
  }

  flushCurrentPackage()

  return {
    packages: toSortedPackages(packages),
    warnings: [] as string[],
  }
}

export async function parsePythonDependencyFile(
  input: ParsePythonDependencyFileInput,
): Promise<ParsePythonDependencyFileResult> {
  void input.rootDir

  if (!isSupportedPythonDependencyFile(input.file.path)) {
    return {
      packages: [],
      warnings: [
        `Unsupported Python dependency file for Task 4 parser: ${input.file.path}`,
      ],
    }
  }

  if (input.file.path.endsWith("pyproject.toml")) {
    return parsePyprojectDependencies(input.file, input.content)
  }

  if (input.file.path.endsWith("poetry.lock")) {
    return parsePoetryLockPackages(input.file, input.content)
  }

  const packages: ResolvedDependency[] = []
  const warnings: string[] = []

  for (const line of input.content.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue
    }

    if (trimmedLine.startsWith("-") || trimmedLine.startsWith("--")) {
      warnings.push(
        `Unsupported Python requirement directive in ${input.file.path}: ${trimmedLine}`,
      )
      continue
    }

    if (isPythonDirectReference(trimmedLine)) {
      warnings.push(
        `Unsupported Python direct reference in ${input.file.path}: ${trimmedLine}`,
      )
      continue
    }

    const parsedRequirement = parsePythonRequirementLine(trimmedLine)
    if (!parsedRequirement) {
      warnings.push(
        `Unsupported Python requirement in ${input.file.path}: ${trimmedLine}`,
      )
      continue
    }

    packages.push(
      input.file.kind === "lockfile"
        ? {
            ecosystem: "pypi",
            name: parsedRequirement.name,
            version: parsedRequirement.version,
            versionKind: "resolved",
            dependencyType: "direct",
            sourcePath: input.file.path,
            sourceKind: input.file.kind,
            confidence: "high",
            note: "resolved from a Python lockfile",
          }
        : buildDeclaredPythonDependency(
            input.file,
            parsedRequirement.name,
            parsedRequirement.version,
          ),
    )
  }

  return {
    packages: toSortedPackages(packages),
    warnings,
  }
}
