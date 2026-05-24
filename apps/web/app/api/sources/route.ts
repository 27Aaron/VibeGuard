import { NextResponse } from "next/server";

import { getPublicSources } from "@/lib/public-data";
import { formatDateTimeInShanghai, toShanghaiIsoOffset } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = await getPublicSources();

  return NextResponse.json({
    meta: {
      count: sources.length,
      generatedAt: toShanghaiIsoOffset(new Date()) ?? new Date().toISOString(),
      generatedAtDisplay: formatDateTimeInShanghai(new Date()),
    },
    items: sources,
  });
}
