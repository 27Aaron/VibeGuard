import { describe, expect, it } from "vitest"

import {
  clearPersistedSecurityWorkbenchState,
  loadPersistedSecurityWorkbenchState,
  savePersistedSecurityWorkbenchState,
  SECURITY_WORKBENCH_STATE_STORAGE_KEY,
  type PersistedSecurityWorkbenchState,
  type SecurityWorkbenchStorage,
} from "../../apps/web/lib/security-workbench-state"

function createMemoryStorage(initialValue?: string): SecurityWorkbenchStorage {
  const entries = new Map<string, string>()
  if (initialValue) {
    entries.set(SECURITY_WORKBENCH_STATE_STORAGE_KEY, initialValue)
  }

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
}

function createUnavailableStorage(): SecurityWorkbenchStorage {
  return {
    getItem: () => {
      throw new Error("session storage unavailable")
    },
    setItem: () => {
      throw new Error("session storage unavailable")
    },
    removeItem: () => {
      throw new Error("session storage unavailable")
    },
  }
}

const persistedState: PersistedSecurityWorkbenchState = {
  ecosystem: "npm",
  packageName: "lodash",
  version: "",
  submittedQuery: { version: null },
  result: {
    empty: true,
    stale: false,
    source: "local-osv-mirror",
    lastSyncedAt: "2026-05-23T00:53:00.000Z",
    findings: [],
  },
}

describe("security workbench persisted state", () => {
  it("keeps the latest package-check result in memory when session storage is unavailable", () => {
    clearPersistedSecurityWorkbenchState(createMemoryStorage())

    savePersistedSecurityWorkbenchState(
      persistedState,
      createUnavailableStorage(),
    )

    expect(
      loadPersistedSecurityWorkbenchState(createUnavailableStorage()),
    ).toEqual(persistedState)
  })

  it("warms the in-memory state after loading from session storage", () => {
    clearPersistedSecurityWorkbenchState(createMemoryStorage())
    const storage = createMemoryStorage(JSON.stringify(persistedState))

    expect(loadPersistedSecurityWorkbenchState(storage)).toEqual(persistedState)

    expect(
      loadPersistedSecurityWorkbenchState(createUnavailableStorage()),
    ).toEqual(persistedState)
  })

  it("drops stale persisted result payloads that predate risk enrichment", () => {
    clearPersistedSecurityWorkbenchState(createMemoryStorage())
    const storage = createMemoryStorage(
      JSON.stringify({
        ...persistedState,
        result: {
          empty: false,
          stale: false,
          source: "local-osv-mirror",
          lastSyncedAt: "2026-05-23T00:53:00.000Z",
          findings: [
            {
              affected: true,
              confidence: "high",
              matchReason: "version_in_ecosystem_range",
              matchSummary: "axios@0.21.1 falls inside an affected range.",
              package: {
                ecosystem: "npm",
                name: "axios",
                version: "0.21.1",
                purl: "pkg:npm/axios",
              },
              advisory: {
                id: "GHSA-example",
                source: "osv",
                riskType: "vulnerability",
                summary: "Old cached payload",
                details: null,
                aliases: [],
                severity: [],
                references: [],
                modifiedAt: null,
              },
              affectedPackage: {
                affectedVersions: [],
                ranges: [],
                fixedVersions: [],
              },
            },
          ],
        },
      }),
    )

    expect(loadPersistedSecurityWorkbenchState(storage)).toEqual({
      ...persistedState,
      result: null,
    })
  })

  it("clears both session storage and the in-memory fallback", () => {
    const storage = createMemoryStorage()
    savePersistedSecurityWorkbenchState(persistedState, storage)

    clearPersistedSecurityWorkbenchState(storage)

    expect(loadPersistedSecurityWorkbenchState(storage)).toBeNull()
    expect(
      loadPersistedSecurityWorkbenchState(createUnavailableStorage()),
    ).toBeNull()
  })
})
