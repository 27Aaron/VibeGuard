import { NextResponse } from "next/server"

import { getPublicOverview } from "@/lib/public-data"
import { formatDateTimeInShanghai, toShanghaiIsoOffset } from "@/lib/time"

export const dynamic = "force-dynamic"

export async function GET() {
  const overview = await getPublicOverview()

  return NextResponse.json({
    meta: {
      generatedAt: toShanghaiIsoOffset(new Date()) ?? new Date().toISOString(),
      generatedAtDisplay: formatDateTimeInShanghai(new Date()),
    },
    overview,
  })
}
