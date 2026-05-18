import { NextRequest, NextResponse } from "next/server"

import { listArticles } from "@/lib/api-articles"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const payload = await listArticles(request.nextUrl.searchParams)

  return NextResponse.json(payload)
}
