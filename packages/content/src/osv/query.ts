import { desc, eq, inArray } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import {
  schema,
  securityAdvisories,
  securityAffectedPackages,
  securitySyncState,
} from "@vibeguard/db"
import type {
  SecurityPackageEcosystem,
  SecurityPackageMatchConfidence,
  SecurityPackageMatchReason,
} from "@vibeguard/shared"

import { evaluateAffectedPackageVersion } from "./version-match"

type ContentDb = NodePgDatabase<typeof schema>

export type PackageCheckInput = {
  ecosystem: SecurityPackageEcosystem
  name: string
  version?: string | null
}

export type CheckPackagesInput = {
  packages: PackageCheckInput[]
  now?: Date
  staleAfterMs?: number
}

export type PackageCheckMetaInput = {
  now?: Date
  lastSyncedAt?: Date | null
  staleAfterMs?: number
}

export type PackageMatchSummaryInput = {
  affected: boolean
  confidence: SecurityPackageMatchConfidence
  matchReason: SecurityPackageMatchReason
  ecosystem: SecurityPackageEcosystem
  name: string
  version?: string | null
}

function normalizePackageKey(ecosystem: SecurityPackageEcosystem, name: string) {
  const trimmed = name.trim()

  if (ecosystem === "pypi") {
    return trimmed.toLowerCase().replace(/[-_.]+/g, "-")
  }

  if (ecosystem === "npm" || ecosystem === "crates-io") {
    return trimmed.toLowerCase()
  }

  return trimmed
}

export function buildPackageCheckMeta({
  now = new Date(),
  lastSyncedAt,
  staleAfterMs = 3 * 60 * 60 * 1000,
}: PackageCheckMetaInput) {
  const stale = !lastSyncedAt || now.getTime() - lastSyncedAt.getTime() > staleAfterMs

  return {
    source: "local-osv-mirror" as const,
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    stale,
  }
}

function formatPackageCoordinate(
  name: string,
  version?: string | null,
) {
  const trimmedVersion = version?.trim()

  return trimmedVersion ? `${name}@${trimmedVersion}` : name
}

function ecosystemLabel(ecosystem: SecurityPackageEcosystem) {
  switch (ecosystem) {
    case "go":
      return "Go"
    case "pypi":
      return "PyPI"
    case "crates-io":
      return "crates.io"
    default:
      return ecosystem
  }
}

export function buildPackageMatchSummary({
  affected,
  confidence,
  matchReason,
  ecosystem,
  name,
  version,
}: PackageMatchSummaryInput) {
  const coordinate = formatPackageCoordinate(name, version)
  const sourceLabel = "the local OSV advisory data"

  switch (matchReason) {
    case "explicit_affected_version":
      return `${coordinate} is explicitly listed as affected in ${sourceLabel}.`
    case "version_in_ecosystem_range":
      return `${coordinate} falls inside an affected ${ecosystemLabel(ecosystem)} version range in ${sourceLabel}.`
    case "version_outside_ecosystem_range":
      return `${coordinate} is outside the affected ${ecosystemLabel(ecosystem)} version ranges in ${sourceLabel}.`
    case "range_present_but_inconclusive":
      return `${coordinate} has matching advisory ranges in ${sourceLabel}, but the current ${confidence}-confidence matcher cannot prove the version is affected yet.`
    case "package_match_without_version":
      return `${coordinate} matches a known package advisory in ${sourceLabel}, but no package version was provided.`
    default: {
      const fallback = affected ? "matched" : "did not match"

      return `${coordinate} ${fallback} an advisory check in ${sourceLabel}.`
    }
  }
}

export async function checkPackagesAgainstLocalDb(
  db: ContentDb,
  input: CheckPackagesInput,
) {
  const syncState = await db.query.securitySyncState.findFirst({
    orderBy: [desc(securitySyncState.lastSuccessAt)],
  })
  const meta = buildPackageCheckMeta({
    now: input.now,
    staleAfterMs: input.staleAfterMs,
    lastSyncedAt: syncState?.lastSuccessAt ?? null,
  })

  if (input.packages.length === 0) {
    return { meta, findings: [] }
  }

  // Batch step 1: collect unique (ecosystem, packageKey) pairs
  const packageLookupKeys = input.packages.map((pkg) => ({
    ecosystem: pkg.ecosystem,
    packageKey: normalizePackageKey(pkg.ecosystem, pkg.name),
    original: pkg,
  }))

  // Build OR conditions for all packages in one query
  const ecosystemKeys = new Map<SecurityPackageEcosystem, Set<string>>()
  for (const { ecosystem, packageKey } of packageLookupKeys) {
    const keys = ecosystemKeys.get(ecosystem)
    if (keys) {
      keys.add(packageKey)
    } else {
      ecosystemKeys.set(ecosystem, new Set([packageKey]))
    }
  }

  // Query all affected packages in batches by ecosystem (inArray requires same column)
  const allAffectedPackages: Array<{
    id: string
    ecosystem: SecurityPackageEcosystem
    packageName: string
    packageKey: string
    purl: string | null
    affectedVersions: string[]
    ranges: Array<{ type?: string; events?: Array<Record<string, string>> }>
    fixedVersions: string[]
    advisoryId: string
  }> = []

  for (const [ecosystem, keys] of ecosystemKeys) {
    const keyArray = Array.from(keys)
    const rows = await db.query.securityAffectedPackages.findMany({
      where: (table, { and, eq: whereEq, inArray: whereInArray }) =>
        and(
          whereEq(table.ecosystem, ecosystem),
          whereInArray(table.packageKey, keyArray),
        ),
    })
    allAffectedPackages.push(...rows)
  }

  if (allAffectedPackages.length === 0) {
    return { meta, findings: [] }
  }

  // Batch step 2: query all advisories in one shot
  const advisoryIds = Array.from(
    new Set(allAffectedPackages.map((ap) => ap.advisoryId)),
  )
  const allAdvisories = await db.query.securityAdvisories.findMany({
    where: inArray(securityAdvisories.id, advisoryIds),
  })
  const advisoryById = new Map(allAdvisories.map((a) => [a.id, a]))

  // Batch step 3: join in memory
  const findings = []

  for (const { original, packageKey } of packageLookupKeys) {
    const matchedAffectedPackages = allAffectedPackages.filter(
      (ap) => ap.ecosystem === original.ecosystem && ap.packageKey === packageKey,
    )

    for (const affectedPackage of matchedAffectedPackages) {
      const advisory = advisoryById.get(affectedPackage.advisoryId)

      if (!advisory || advisory.withdrawnAt) {
        continue
      }

      const match = evaluateAffectedPackageVersion({
        ecosystem: original.ecosystem,
        version: original.version,
        affectedVersions: affectedPackage.affectedVersions,
        ranges: affectedPackage.ranges,
      })

      if (!match.affected && match.matchReason !== "package_match_without_version") {
        continue
      }

      findings.push({
        affected: match.affected,
        confidence: match.confidence,
        matchReason: match.matchReason,
        matchSummary: buildPackageMatchSummary({
          affected: match.affected,
          confidence: match.confidence,
          matchReason: match.matchReason,
          ecosystem: original.ecosystem,
          name: original.name,
          version: original.version,
        }),
        package: {
          ecosystem: original.ecosystem,
          name: original.name,
          version: original.version ?? null,
          purl: affectedPackage.purl,
        },
        advisory: {
          id: advisory.externalId,
          source: advisory.source,
          riskType: advisory.riskType,
          summary: advisory.summary,
          details: advisory.details,
          aliases: advisory.aliases,
          severity: advisory.severity,
          references: advisory.references,
          modifiedAt: advisory.modifiedAt?.toISOString() ?? null,
        },
        affectedPackage: {
          affectedVersions: affectedPackage.affectedVersions,
          ranges: affectedPackage.ranges,
          fixedVersions: affectedPackage.fixedVersions,
        },
      })
    }
  }

  return {
    meta,
    findings,
  }
}
