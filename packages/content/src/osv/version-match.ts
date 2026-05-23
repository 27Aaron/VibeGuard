import {
  type SecurityPackageEcosystem,
  type SecurityPackageMatchConfidence,
  type SecurityPackageMatchReason,
} from "@vibeguard/shared"
import { coerce, compare, valid } from "semver"

type OsvRange = {
  type?: string
  events?: Array<Record<string, string>>
}

export type EvaluateAffectedPackageVersionInput = {
  ecosystem: SecurityPackageEcosystem
  version?: string | null
  affectedVersions: string[]
  ranges: OsvRange[]
}

export type PackageVersionMatchResult = {
  affected: boolean
  confidence: SecurityPackageMatchConfidence
  matchReason: SecurityPackageMatchReason
}

type ComparableVersion = {
  raw: string
  compareTo(other: ComparableVersion): number
}

type Segment = {
  introduced?: string
  fixed?: string
  lastAffected?: string
}

function trimVersion(value?: string | null) {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}

type PreReleaseTag = "dev" | "alpha" | "a" | "beta" | "b" | "rc" | "final" | null

const PRE_RELEASE_ORDER: Record<string, number> = {
  dev: 0,
  alpha: 1,
  a: 1,
  beta: 2,
  b: 2,
  rc: 3,
  final: 4,
}

function parsePreReleaseTag(tag: string): { type: PreReleaseTag; number: number } | null {
  const match = tag.match(/^(dev|alpha|a|beta|b|rc|final)\.?(\d*)$/i)
  if (!match) {
    return null
  }

  return {
    type: match[1].toLowerCase() as PreReleaseTag,
    number: match[2] ? Number(match[2]) : 0,
  }
}

export function parseSimpleNumericVersion(raw: string): ComparableVersion | null {
  const preReleaseMatch = raw.match(/^(.+?)(?:[-_.]|(?=[a-zA-Z]))(dev|alpha|a|beta|b|rc|final)\.?(\d*)(?:[-_.].*)?$/i)
  const numericPart = preReleaseMatch?.[1] ?? raw
  const preReleaseTag = preReleaseMatch?.[2] ?? null
  const preReleaseNum = preReleaseMatch?.[3] ? Number(preReleaseMatch[3]) : 0

  if (!/^\d+(?:\.\d+)*$/.test(numericPart)) {
    return null
  }

  const parts = numericPart.split(".").map((part) => Number(part))
  const tagOrder = preReleaseTag
    ? (PRE_RELEASE_ORDER[preReleaseTag.toLowerCase()] ?? 0)
    : Infinity

  return {
    raw,
    compareTo(other) {
      const otherPreReleaseMatch = other.raw.match(/^(.+?)(?:[-_.]|(?=[a-zA-Z]))(dev|alpha|a|beta|b|rc|final)\.?(\d*)(?:[-_.].*)?$/i)
      const otherNumericPart = otherPreReleaseMatch?.[1] ?? other.raw
      const otherPreReleaseTag = otherPreReleaseMatch?.[2] ?? null
      const otherPreReleaseNum = otherPreReleaseMatch?.[3] ? Number(otherPreReleaseMatch[3]) : 0

      if (!/^\d+(?:\.\d+)*$/.test(otherNumericPart)) {
        return 1
      }

      const otherParts = otherNumericPart.split(".").map((part) => Number(part))
      const length = Math.max(parts.length, otherParts.length)

      for (let index = 0; index < length; index += 1) {
        const left = parts[index] ?? 0
        const right = otherParts[index] ?? 0

        if (left !== right) {
          return left < right ? -1 : 1
        }
      }

      const otherTagOrder = otherPreReleaseTag
        ? (PRE_RELEASE_ORDER[otherPreReleaseTag.toLowerCase()] ?? 0)
        : Infinity

      if (tagOrder !== otherTagOrder) {
        return tagOrder < otherTagOrder ? -1 : 1
      }

      if (preReleaseNum !== otherPreReleaseNum) {
        return preReleaseNum < otherPreReleaseNum ? -1 : 1
      }

      return 0
    },
  }
}

function parseSemverLikeVersion(raw: string): ComparableVersion | null {
  const normalized = valid(raw, { loose: true }) ?? coerce(raw)?.version

  if (!normalized) {
    return null
  }

  return {
    raw: normalized,
    compareTo(other) {
      return compare(normalized, other.raw, true)
    },
  }
}

function parseComparableVersion(
  ecosystem: SecurityPackageEcosystem,
  raw: string,
): ComparableVersion | null {
  if (raw === "0") {
    return parseSemverLikeVersion("0.0.0")
  }

  if (ecosystem === "pypi") {
    return parseSimpleNumericVersion(raw)
  }

  return parseSemverLikeVersion(raw)
}

function buildSegments(range: OsvRange): Segment[] {
  const segments: Segment[] = []
  let currentIntroduced: string | undefined

  for (const event of range.events ?? []) {
    if (typeof event.introduced === "string") {
      currentIntroduced = event.introduced
    }

    if (typeof event.fixed === "string") {
      segments.push({
        introduced: currentIntroduced,
        fixed: event.fixed,
      })
      currentIntroduced = undefined
    }

    if (typeof event.last_affected === "string") {
      segments.push({
        introduced: currentIntroduced,
        lastAffected: event.last_affected,
      })
      currentIntroduced = undefined
    }
  }

  if (currentIntroduced) {
    segments.push({ introduced: currentIntroduced })
  }

  return segments
}

function makeResult(
  affected: boolean,
  confidence: SecurityPackageMatchConfidence,
  matchReason: SecurityPackageMatchReason,
): PackageVersionMatchResult {
  return {
    affected,
    confidence,
    matchReason,
  }
}

export function evaluateAffectedPackageVersion({
  ecosystem,
  version,
  affectedVersions,
  ranges,
}: EvaluateAffectedPackageVersionInput): PackageVersionMatchResult {
  const normalizedVersion = trimVersion(version)

  if (!normalizedVersion) {
    return makeResult(false, "low", "package_match_without_version")
  }

  if (
    affectedVersions.some((affectedVersion) => trimVersion(affectedVersion) === normalizedVersion)
  ) {
    return makeResult(true, "high", "explicit_affected_version")
  }

  const subject = parseComparableVersion(ecosystem, normalizedVersion)
  const ecosystemRanges = ranges.filter(
    (range) => range.type === "ECOSYSTEM" && (range.events?.length ?? 0) > 0,
  )

  if (ecosystemRanges.length === 0) {
    return makeResult(false, "none", "version_outside_ecosystem_range")
  }

  if (!subject) {
    return makeResult(false, "medium", "range_present_but_inconclusive")
  }

  let hadEvaluatedSegment = false
  let hadInconclusiveSegment = false

  for (const range of ecosystemRanges) {
    for (const segment of buildSegments(range)) {
      let lowerBound: ComparableVersion | null = null

      if (segment.introduced && segment.introduced !== "0") {
        lowerBound = parseComparableVersion(ecosystem, segment.introduced)

        if (!lowerBound) {
          hadInconclusiveSegment = true
          continue
        }
      }

      const fixedBound = segment.fixed
        ? parseComparableVersion(ecosystem, segment.fixed)
        : null

      if (segment.fixed && !fixedBound) {
        hadInconclusiveSegment = true
        continue
      }

      const lastAffectedBound = segment.lastAffected
        ? parseComparableVersion(ecosystem, segment.lastAffected)
        : null

      if (segment.lastAffected && !lastAffectedBound) {
        hadInconclusiveSegment = true
        continue
      }

      hadEvaluatedSegment = true

      if (lowerBound && subject.compareTo(lowerBound) < 0) {
        continue
      }

      if (fixedBound && subject.compareTo(fixedBound) >= 0) {
        continue
      }

      if (lastAffectedBound && subject.compareTo(lastAffectedBound) > 0) {
        continue
      }

      return makeResult(true, "high", "version_in_ecosystem_range")
    }
  }

  if (hadInconclusiveSegment) {
    return makeResult(false, "medium", "range_present_but_inconclusive")
  }

  if (hadEvaluatedSegment) {
    return makeResult(false, "none", "version_outside_ecosystem_range")
  }

  return makeResult(false, "medium", "range_present_but_inconclusive")
}
