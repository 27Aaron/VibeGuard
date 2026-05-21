import type { DetectedDependencyFile, ResolvedDependency } from "../types"

type ParsePythonDependencyFileInput = {
  rootDir: string
  file: DetectedDependencyFile
  content: string
}

type ParsePythonDependencyFileResult = {
  packages: ResolvedDependency[]
  warnings: string[]
}

function toSortedPackages(packages: ResolvedDependency[]) {
  return [...packages].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name)
    if (nameComparison !== 0) {
      return nameComparison
    }

    return (left.version ?? "").localeCompare(right.version ?? "")
  })
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
  return filePath.endsWith("requirements.txt")
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

    if (trimmedLine.includes(" @ ")) {
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

    packages.push({
      ecosystem: "pypi",
      name: parsedRequirement.name,
      version: parsedRequirement.version,
      dependencyType: "direct",
      sourcePath: input.file.path,
      sourceKind: input.file.kind,
      confidence: input.file.kind === "lockfile" ? "high" : "medium",
      note:
        input.file.kind === "lockfile"
          ? "resolved from a Python lockfile"
          : "declared dependency without a lockfile",
    })
  }

  return {
    packages: toSortedPackages(packages),
    warnings,
  }
}
