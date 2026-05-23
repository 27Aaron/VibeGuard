import { NextRequest, NextResponse } from "next/server"

import { listArticles } from "@/lib/api-articles"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Force status=ready for public API — strip any client-supplied status
  // to prevent leaking non-public articles.
  const safeParams = new URLSearchParams(request.nextUrl.searchParams)
  safeParams.delete("status")

  const payload = await listArticles(safeParams)

  return NextResponse.json(payload)
}
