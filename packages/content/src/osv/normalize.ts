import {
  SecurityPackageEcosystem,
  SecurityParseStatus,
  SecurityRiskType,
  type SecurityPackageEcosystem as SecurityPackageEcosystemValue,
  type SecurityRiskType as SecurityRiskTypeValue,
} from "@vibeguard/shared"

import type { OsvDumpEcosystem } from "./cache"

type OsvSeverity = {
  type?: string
  score?: string
}

type OsvReference = {
  type?: string
  url?: string
}

type OsvRange = {
  type?: string
  repo?: string
  events?: Array<Record<string, string>>
  database_specific?: Record<string, unknown>
}

type OsvAffected = {
  package?: {
    name?: string
    ecosystem?: string
    purl?: string
  }
  severity?: OsvSeverity[]
  ranges?: OsvRange[]
  versions?: string[]
}

export type OsvVulnerability = {
  schema_version?: string
  id?: string
  modified?: string
  published?: string
  withdrawn?: string
  aliases?: string[]
  summary?: string
  details?: string
  severity?: OsvSeverity[]
  affected?: OsvAffected[]
  references?: OsvReference[]
}

type NormalizeOsvRecordOptions = {
  sourceUrl: string
  dumpEcosystems: OsvDumpEcosystem[]
  rawHash?: string
  rawSizeBytes?: number
  syncedAt?: Date
}

export type NormalizedOsvSourceRecord = {
  source: "osv"
  externalId: string
  sourceUrl: string
  sourceEcosystems: OsvDumpEcosystem[]
  schemaVersion: string | null
  modifiedAt: Date | null
  publishedAt: Date | null
  withdrawnAt: Date | null
  rawHash: string | null
  rawSizeBytes: number | null
  syncedAt: Date
  parseStatus: typeof SecurityParseStatus.PARSED
  parseError: null
}

export type NormalizedOsvAdvisory = {
  source: "osv"
  externalId: string
  riskType: SecurityRiskTypeValue
  summary: string
  details: string | null
  aliases: string[]
  severity: OsvSeverity[]
  publishedAt: Date | null
  modifiedAt: Date | null
  withdrawnAt: Date | null
  references: Array<{ type?: string; url: string }>
}

export type NormalizedOsvAffectedPackage = {
  ecosystem: SecurityPackageEcosystemValue
  packageName: string
  packageKey: string
  purl: string | null
  affectedVersions: string[]
  ranges: OsvRange[]
  fixedVersions: string[]
}

export type NormalizedOsvRecord = {
  sourceRecord: NormalizedOsvSourceRecord
  advisory: NormalizedOsvAdvisory
  affectedPackages: NormalizedOsvAffectedPackage[]
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

export function normalizeOsvPackageEcosystem(
  ecosystem: string,
): SecurityPackageEcosystemValue | null {
  switch (ecosystem) {
    case "npm":
      return SecurityPackageEcosystem.NPM
    case "PyPI":
      return SecurityPackageEcosystem.PYPI
    case "Go":
      return SecurityPackageEcosystem.GO
    case "crates.io":
      return SecurityPackageEcosystem["CRATES-IO"]
    default:
      return null
  }
}

export function normalizeOsvPackageKey(ecosystem: string, packageName: string) {
  const trimmed = packageName.trim()

  if (ecosystem === "PyPI") {
    return trimmed.toLowerCase().replace(/[-_.]+/g, "-")
  }

  if (ecosystem === "npm" || ecosystem === "crates.io") {
    return trimmed.toLowerCase()
  }

  return trimmed
}

function inferRiskType(vulnerability: OsvVulnerability): SecurityRiskTypeValue {
  const corpus = [
    vulnerability.id ?? "",
    vulnerability.summary ?? "",
    vulnerability.details ?? "",
  ].join("\n")

  if (/^MAL-/i.test(vulnerability.id ?? "") || /\bmalicious\b/i.test(corpus)) {
    return SecurityRiskType["MALICIOUS-PACKAGE"]
  }

  return SecurityRiskType.VULNERABILITY
}

function normalizeReferences(references: OsvReference[] | undefined) {
  return (references ?? []).flatMap((reference) => {
    if (!reference.url) {
      return []
    }

    return [
      {
        type: reference.type,
        url: reference.url,
      },
    ]
  })
}

function fixedVersionsFromRanges(ranges: OsvRange[] | undefined) {
  return uniqueStrings(
    (ranges ?? []).flatMap((range) =>
      (range.events ?? []).map((event) => event.fixed),
    ),
  )
}

function normalizeAffectedPackages(affected: OsvAffected[] | undefined) {
  const packagesByKey = new Map<string, NormalizedOsvAffectedPackage>()

  for (const affectedPackage of affected ?? []) {
    const packageName = affectedPackage.package?.name?.trim()
    const osvEcosystem = affectedPackage.package?.ecosystem?.trim()

    if (!packageName || !osvEcosystem) {
      continue
    }

    const ecosystem = normalizeOsvPackageEcosystem(osvEcosystem)

    if (!ecosystem) {
      continue
    }

    const packageKey = normalizeOsvPackageKey(osvEcosystem, packageName)
    const mapKey = `${ecosystem}\0${packageKey}`
    const existing = packagesByKey.get(mapKey)
    const ranges = affectedPackage.ranges ?? []
    const fixedVersions = fixedVersionsFromRanges(ranges)

    if (existing) {
      existing.affectedVersions = uniqueStrings([
        ...existing.affectedVersions,
        ...(affectedPackage.versions ?? []),
      ])
      existing.ranges = [...existing.ranges, ...ranges]
      existing.fixedVersions = uniqueStrings([
        ...existing.fixedVersions,
        ...fixedVersions,
      ])
      existing.purl = existing.purl ?? affectedPackage.package?.purl ?? null
      continue
    }

    packagesByKey.set(mapKey, {
      ecosystem,
      packageName,
      packageKey,
      purl: affectedPackage.package?.purl ?? null,
      affectedVersions: uniqueStrings(affectedPackage.versions ?? []),
      ranges,
      fixedVersions,
    })
  }

  return Array.from(packagesByKey.values())
}

export function normalizeOsvRecord(
  vulnerability: OsvVulnerability,
  options: NormalizeOsvRecordOptions,
): NormalizedOsvRecord {
  if (!vulnerability.id) {
    throw new Error("OSV vulnerability id is required")
  }

  return {
    sourceRecord: {
      source: "osv",
      externalId: vulnerability.id,
      sourceUrl: options.sourceUrl,
      sourceEcosystems: options.dumpEcosystems,
      schemaVersion: vulnerability.schema_version ?? null,
      modifiedAt: parseDate(vulnerability.modified),
      publishedAt: parseDate(vulnerability.published),
      withdrawnAt: parseDate(vulnerability.withdrawn),
      rawHash: options.rawHash ?? null,
      rawSizeBytes: options.rawSizeBytes ?? null,
      syncedAt: options.syncedAt ?? new Date(),
      parseStatus: SecurityParseStatus.PARSED,
      parseError: null,
    },
    advisory: {
      source: "osv",
      externalId: vulnerability.id,
      riskType: inferRiskType(vulnerability),
      summary: vulnerability.summary ?? "",
      details: vulnerability.details ?? null,
      aliases: uniqueStrings(vulnerability.aliases ?? []),
      severity: vulnerability.severity ?? [],
      publishedAt: parseDate(vulnerability.published),
      modifiedAt: parseDate(vulnerability.modified),
      withdrawnAt: parseDate(vulnerability.withdrawn),
      references: normalizeReferences(vulnerability.references),
    },
    affectedPackages: normalizeAffectedPackages(vulnerability.affected),
  }
}
