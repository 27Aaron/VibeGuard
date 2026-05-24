import { NextResponse } from "next/server"

import { getDb } from "@vibeguard/db"

import { getSecuritySyncStatus } from "../../../../../lib/security-api"

export const dynamic = "force-dynamic"

export async function GET() {
  const payload = await getSecuritySyncStatus(getDb())

  return NextResponse.json(payload)
}
