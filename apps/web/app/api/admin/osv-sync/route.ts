import { desc } from "drizzle-orm"

import { getDb, securitySyncState } from "@vibeguard/db"

import { requireAdminAuth } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.authorized) return auth.response

  const db = getDb()

  const rows = await db.query.securitySyncState.findMany({
    orderBy: [desc(securitySyncState.lastSuccessAt)],
  })

  const ecosystems = rows.map((row) => ({
    ecosystem: row.ecosystem,
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
  }
}
