import { desc, eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"

import {
  schema,
  securityAdvisories,
  securityAffectedPackages,
  securitySyncState,
} from "@vibeguard/db"
import type { SecurityPackageEcosystem } from "@vibeguard/shared"

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
  staleAfterMs = 6 * 60 * 60 * 1000,
}: PackageCheckMetaInput) {
  const stale = !lastSyncedAt || now.getTime() - lastSyncedAt.getTime() > staleAfterMs

  return {
    source: "local-osv-mirror" as const,
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    stale,
    warning: stale ? "Local OSV mirror is stale; run the OSV sync job." : null,
  }
}

function isExplicitlyAffected(affectedVersions: string[], version?: string | null) {
  if (!version) {
    return false
  }

  return affectedVersions.includes(version.trim())
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
  const findings = []

  for (const packageInput of input.packages) {
    const packageKey = normalizePackageKey(
      packageInput.ecosystem,
      packageInput.name,
    )
    const affectedPackages = await db.query.securityAffectedPackages.findMany({
      where: (table, { and, eq: whereEq }) =>
        and(
          whereEq(table.ecosystem, packageInput.ecosystem),
          whereEq(table.packageKey, packageKey),
        ),
    })

    for (const affectedPackage of affectedPackages) {
      const advisory = await db.query.securityAdvisories.findFirst({
        where: eq(securityAdvisories.id, affectedPackage.advisoryId),
      })

      if (!advisory || advisory.withdrawnAt) {
        continue
      }

      const affected = isExplicitlyAffected(
        affectedPackage.affectedVersions,
        packageInput.version,
      )

      if (!affected) {
        continue
      }

      findings.push({
        affected,
        package: {
          ecosystem: packageInput.ecosystem,
          name: packageInput.name,
          version: packageInput.version ?? null,
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
