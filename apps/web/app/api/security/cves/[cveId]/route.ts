import { NextResponse } from "next/server";

import { getDb } from "@vibeguard/db";

import { getSecurityCveDetail } from "../../../../../lib/security-api";

export const dynamic = "force-dynamic";

type CveDetailRouteProps = {
  params: Promise<{
    cveId: string;
  }>;
};

export async function GET(_request: Request, { params }: CveDetailRouteProps) {
  const { cveId } = await params;
  const payload = await getSecurityCveDetail(getDb(), cveId);

  if (!payload) {
    return NextResponse.json(
      {
        error: "CVE not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(payload);
}
