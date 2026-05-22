import { NextResponse } from "next/server"

import { checkPackagesAgainstLocalDb } from "@vibeguard/content/osv/query"
import { getDb } from "@vibeguard/db"

import { parseSecurityPackageCheckBody } from "../../../../../lib/api-security"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    )
  }

  const parsed = parseSecurityPackageCheckBody(body)

  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.message,
      },
      { status: 400 },
    )
  }

  const payload = await checkPackagesAgainstLocalDb(getDb(), {
    packages: parsed.packages,
  })

  return NextResponse.json(payload)
}
