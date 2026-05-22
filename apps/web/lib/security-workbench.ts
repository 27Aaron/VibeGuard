import type { checkPackagesAgainstLocalDb } from "@vibeguard/content/osv/query"
import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  SECURITY_PACKAGE_MATCH_CONFIDENCE_VALUES,
  SECURITY_PACKAGE_MATCH_REASON_VALUES,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared"

export type SecurityCheckPayload = Awaited<ReturnType<typeof checkPackagesAgainstLocalDb>>
export type SecurityFinding = SecurityCheckPayload["findings"][number]
export type SecurityFindingConfidence = SecurityFinding["confidence"]

type SecurityRange = SecurityFinding["affectedPackage"]["ranges"][number]

export function buildSecurityCheckRequestBody(input: {
  ecosystem: SecurityPackageEcosystem
  name: string
  version: string
}) {
  const trimmedName = input.name.trim()
  const trimmedVersion = input.version.trim()

  return {
    packages: [
      {
        ecosystem: input.ecosystem,
        name: trimmedName,
        version: trimmedVersion || null,
      },
    ],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isOneOf<TValue extends string>(
  allowed: readonly TValue[],
  value: unknown,
): value is TValue {
  return typeof value === "string" && allowed.includes(value as TValue)
}

function isReferenceEntry(value: unknown) {
  const url =
    isRecord(value) && typeof value.url === "string"
      ? (() => {
          try {
            return new URL(value.url)
          } catch {
            return null
          }
        })()
      : null

  return (
    isRecord(value) &&
    (typeof value.type === "string" || value.type === null || value.type === undefined) &&
    !!url &&
    (url.protocol === "http:" || url.protocol === "https:")
  )
}

function isSeverityEntry(value: unknown) {
  return (
    isRecord(value) &&
    (typeof value.type === "string" || value.type === null || value.type === undefined) &&
    (typeof value.score === "string" || value.score === null || value.score === undefined)
  )
}

function isRangeEventEntry(value: unknown) {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string")
}

function isRangeEntry(value: unknown) {
  return (
    isRecord(value) &&
    (typeof value.type === "string" || value.type === null || value.type === undefined) &&
    (value.events === undefined ||
      (Array.isArray(value.events) && value.events.every(isRangeEventEntry)))
  )
}

function isSecurityFinding(value: unknown): value is SecurityFinding {
  if (!isRecord(value)) {
    return false
  }

  const structurallyValid =
    typeof value.affected === "boolean" &&
    isOneOf(SECURITY_PACKAGE_MATCH_CONFIDENCE_VALUES, value.confidence) &&
    isOneOf(SECURITY_PACKAGE_MATCH_REASON_VALUES, value.matchReason) &&
    typeof value.matchSummary === "string" &&
    isRecord(value.package) &&
    isOneOf(SECURITY_PACKAGE_ECOSYSTEM_VALUES, value.package.ecosystem) &&
    typeof value.package.name === "string" &&
    (typeof value.package.version === "string" || value.package.version === null) &&
    (typeof value.package.purl === "string" || value.package.purl === null) &&
    isRecord(value.advisory) &&
    typeof value.advisory.id === "string" &&
    typeof value.advisory.source === "string" &&
    typeof value.advisory.riskType === "string" &&
    (typeof value.advisory.summary === "string" || value.advisory.summary === null) &&
    (typeof value.advisory.details === "string" || value.advisory.details === null) &&
    isStringArray(value.advisory.aliases) &&
    Array.isArray(value.advisory.severity) &&
    value.advisory.severity.every(isSeverityEntry) &&
    Array.isArray(value.advisory.references) &&
    value.advisory.references.every(isReferenceEntry) &&
    (typeof value.advisory.modifiedAt === "string" || value.advisory.modifiedAt === null) &&
    isRecord(value.affectedPackage) &&
    isStringArray(value.affectedPackage.affectedVersions) &&
    Array.isArray(value.affectedPackage.ranges) &&
    value.affectedPackage.ranges.every(isRangeEntry) &&
    isStringArray(value.affectedPackage.fixedVersions)

  if (!structurallyValid) {
    return false
  }

  if (value.affected) {
    return (
      value.confidence === "high" &&
      (value.matchReason === "explicit_affected_version" ||
        value.matchReason === "version_in_ecosystem_range")
    )
  }

  if (value.matchReason === "version_outside_ecosystem_range") {
    return value.confidence === "none"
  }

  if (value.matchReason === "package_match_without_version") {
    return value.confidence === "low"
  }

  if (value.matchReason === "range_present_but_inconclusive") {
    return value.confidence === "low" || value.confidence === "medium"
  }

  return false
}

function isSecurityCheckPayload(value: unknown): value is SecurityCheckPayload {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<SecurityCheckPayload>

  return (
    !!candidate.meta &&
    typeof candidate.meta.source === "string" &&
    (typeof candidate.meta.lastSyncedAt === "string" || candidate.meta.lastSyncedAt === null) &&
    typeof candidate.meta.stale === "boolean" &&
    Array.isArray(candidate.findings) &&
    candidate.findings.every(isSecurityFinding)
  )
}

export function parseSecurityCheckPayload(value: unknown) {
  if (!isSecurityCheckPayload(value)) {
    throw new Error("Malformed security check response.")
  }

  return value
}

export function getSecurityFindingTone(
  input: Pick<SecurityFinding, "affected" | "matchReason">,
) {
  if (input.affected) {
    return "hit"
  }

  switch (input.matchReason) {
    case "package_match_without_version":
    case "range_present_but_inconclusive":
      return "inconclusive"
    case "explicit_affected_version":
    case "version_in_ecosystem_range":
    case "version_outside_ecosystem_range":
      return "clear"
    default: {
      const exhaustiveCheck: never = input.matchReason

      return exhaustiveCheck
    }
  }
}

function formatRangeEvent(event: Record<string, string>) {
  if ("introduced" in event && "fixed" in event) {
    return `>= ${event.introduced}, < ${event.fixed}`
  }

  if ("introduced" in event && "last_affected" in event) {
    return `>= ${event.introduced}, <= ${event.last_affected}`
  }

  if ("introduced" in event) {
    return `>= ${event.introduced}`
  }

  if ("fixed" in event) {
    return `< ${event.fixed}`
  }

  if ("last_affected" in event) {
    return `<= ${event.last_affected}`
  }

  return null
}

export function formatAffectedRanges(ranges: SecurityRange[]) {
  return ranges.flatMap((range) => {
    if (range.type !== "ECOSYSTEM" || !Array.isArray(range.events) || range.events.length === 0) {
      return []
    }

    const formatted: string[] = []
    let introduced: string | null = null

    for (const event of range.events) {
      if ("introduced" in event) {
        introduced = event.introduced
      }

      if (introduced && "fixed" in event) {
        formatted.push(`>= ${introduced}, < ${event.fixed}`)
        introduced = null
        continue
      }

      if (introduced && "last_affected" in event) {
        formatted.push(`>= ${introduced}, <= ${event.last_affected}`)
        introduced = null
        continue
      }

      if (!introduced) {
        const fallback = formatRangeEvent(event)

        if (fallback) {
          formatted.push(fallback)
        }
      }
    }

    if (introduced) {
      formatted.push(`>= ${introduced}`)
    }

    return formatted
  })
}

export function buildSecurityWorkbenchResultState(payload: SecurityCheckPayload) {
  return {
    empty: payload.findings.length === 0,
    stale: payload.meta.stale,
    source: payload.meta.source,
    lastSyncedAt: payload.meta.lastSyncedAt,
    findings: payload.findings,
  }
}
