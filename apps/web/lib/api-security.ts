import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared"

export const SECURITY_PACKAGE_CHECK_MAX_PACKAGES = 100

export type SecurityPackageCheckCoordinate = {
  ecosystem: SecurityPackageEcosystem
  name: string
  version: string | null
}

type ParseSecurityPackageCheckResult =
  | {
      ok: true
      packages: SecurityPackageCheckCoordinate[]
    }
  | {
      ok: false
      message: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSupportedEcosystem(
  value: string,
): value is SecurityPackageEcosystem {
  return SECURITY_PACKAGE_ECOSYSTEM_VALUES.includes(
    value as SecurityPackageEcosystem,
  )
}

export function parseSecurityPackageCheckBody(
  body: unknown,
): ParseSecurityPackageCheckResult {
  if (!isRecord(body) || !Array.isArray(body.packages)) {
    return {
      ok: false,
      message: "packages must be an array.",
    }
  }

  if (body.packages.length === 0) {
    return {
      ok: false,
      message: "packages must include at least one package.",
    }
  }

  if (body.packages.length > SECURITY_PACKAGE_CHECK_MAX_PACKAGES) {
    return {
      ok: false,
      message: `packages cannot contain more than ${SECURITY_PACKAGE_CHECK_MAX_PACKAGES} packages.`,
    }
  }

  const packages: SecurityPackageCheckCoordinate[] = []

  for (const [index, item] of body.packages.entries()) {
    if (!isRecord(item)) {
      return {
        ok: false,
        message: `packages[${index}] must be an object.`,
      }
    }

    const ecosystem = String(item.ecosystem ?? "").trim()

    if (!isSupportedEcosystem(ecosystem)) {
      return {
        ok: false,
        message: `packages[${index}].ecosystem must be one of ${SECURITY_PACKAGE_ECOSYSTEM_VALUES.join(", ")}.`,
      }
    }

    const name = String(item.name ?? "").trim()

    if (!name) {
      return {
        ok: false,
        message: `packages[${index}].name is required.`,
      }
    }

    const version =
      typeof item.version === "string" && item.version.trim()
        ? item.version.trim()
        : null

    packages.push({
      ecosystem,
      name,
      version,
    })
  }

  return {
    ok: true,
    packages,
  }
}
