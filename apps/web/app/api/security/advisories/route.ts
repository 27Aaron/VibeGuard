import { NextResponse } from "next/server";

import { getDb } from "@vibeguard/db";

import { listSecurityAdvisories } from "../../../../lib/security-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const payload = await listSecurityAdvisories(
    getDb(),
    new URL(request.url).searchParams,
  );

  return NextResponse.json(payload);
}
