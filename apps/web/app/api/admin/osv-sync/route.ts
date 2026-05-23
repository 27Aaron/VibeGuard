import { desc, eq } from "drizzle-orm"

import { getDb, securitySyncState } from "@vibeguard/db"

import { requireAdminAuth } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

let osvSyncInProgress = false

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.authorized) return auth.response

  const db = getDb()

  const rows = await db.query.securitySyncState.findMany({
    where: eq(securitySyncState.source, "osv"),
    orderBy: [desc(securitySyncState.lastSuccessAt)],
  })

  const ecosystems = rows.map((row) => ({
    ecosystem: row.scope,
    status: row.status,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastError: row.lastError ?? null,
    recordsImported: row.recordsImported,
    recordsFailed: row.recordsFailed,
  }))

  return Response.json({ ecosystems })
}

export async function POST() {
  const auth = await requireAdminAuth()
  if (!auth.authorized) return auth.response

  if (osvSyncInProgress) {
    return Response.json(
      { ok: false, error: "OSV sync is already in progress. Please wait for it to finish." },
      { status: 409 },
    )
  }

  osvSyncInProgress = true

  try {
    const { syncAllOsvEcosystems } = await import("@vibeguard/content/osv/sync")
    const results = await syncAllOsvEcosystems({ db: getDb() })

    return Response.json({
      ok: true,
      results: results.map((r) => ({
        ecosystem: r.ecosystem,
        imported: r.recordsImported,
        new: r.recordsNew,
        changed: r.recordsChanged,
        failed: r.recordsFailed,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  } finally {
    osvSyncInProgress = false
  }
}
