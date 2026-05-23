import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared"

import type { buildSecurityWorkbenchResultState } from "./security-workbench"

export const SECURITY_WORKBENCH_STATE_STORAGE_KEY = "vibeguard-check-state"

export type SecurityWorkbenchStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>

export type SecurityWorkbenchSubmittedQuery = {
  version: string | null
}

export type SecurityWorkbenchResultState = ReturnType<
  typeof buildSecurityWorkbenchResultState
>

export type PersistedSecurityWorkbenchState = {
  ecosystem: SecurityPackageEcosystem
  packageName: string
  version: string
  submittedQuery: SecurityWorkbenchSubmittedQuery | null
  result: SecurityWorkbenchResultState | null
}

let inMemoryState: PersistedSecurityWorkbenchState | null = null

function getBrowserSessionStorage(): SecurityWorkbenchStorage | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function normalizeSubmittedQuery(
  value: unknown,
): SecurityWorkbenchSubmittedQuery | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    version: typeof value.version === "string" ? value.version : null,
  }
}

function normalizeResult(value: unknown): SecurityWorkbenchResultState | null {
  return isRecord(value) ? (value as SecurityWorkbenchResultState) : null
}

function normalizePersistedState(
  value: unknown,
): PersistedSecurityWorkbenchState | null {
  if (
    !isRecord(value) ||
    !SECURITY_PACKAGE_ECOSYSTEM_VALUES.includes(
      value.ecosystem as SecurityPackageEcosystem,
    )
  ) {
    return null
  }

  return {
    ecosystem: value.ecosystem as SecurityPackageEcosystem,
    packageName: typeof value.packageName === "string" ? value.packageName : "",
    version: typeof value.version === "string" ? value.version : "",
    submittedQuery: normalizeSubmittedQuery(value.submittedQuery),
    result: normalizeResult(value.result),
  }
}

export function loadPersistedSecurityWorkbenchState(
  storage: SecurityWorkbenchStorage | null = getBrowserSessionStorage(),
) {
  try {
    const raw = storage?.getItem(SECURITY_WORKBENCH_STATE_STORAGE_KEY)
    if (!raw) {
      return inMemoryState
    }

    const parsed = normalizePersistedState(JSON.parse(raw))
    if (parsed) {
      inMemoryState = parsed
      return parsed
    }
  } catch {
    // Keep the in-memory fallback below.
  }

  return inMemoryState
}

export function savePersistedSecurityWorkbenchState(
  state: PersistedSecurityWorkbenchState,
  storage: SecurityWorkbenchStorage | null = getBrowserSessionStorage(),
) {
  inMemoryState = state

  try {
    storage?.setItem(
      SECURITY_WORKBENCH_STATE_STORAGE_KEY,
      JSON.stringify(state),
    )
  } catch {
    // The in-memory fallback still preserves state during this tab session.
  }
}

export function clearPersistedSecurityWorkbenchState(
  storage: SecurityWorkbenchStorage | null = getBrowserSessionStorage(),
) {
  inMemoryState = null

  try {
    storage?.removeItem(SECURITY_WORKBENCH_STATE_STORAGE_KEY)
  } catch {
    // Ignore unavailable browser storage.
  }
}
