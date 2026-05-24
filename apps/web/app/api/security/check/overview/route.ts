import { NextResponse } from "next/server";

import { getDb } from "@vibeguard/db";

import { getSecurityOverviewTotals } from "../../../../../lib/security-overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const totals = await getSecurityOverviewTotals(getDb());

  return NextResponse.json({ totals });
}
