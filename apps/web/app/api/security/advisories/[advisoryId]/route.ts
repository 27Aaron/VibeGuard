import { NextResponse } from "next/server";

import { getDb } from "@vibeguard/db";

import { getSecurityAdvisoryDetail } from "../../../../../lib/security-api";

export const dynamic = "force-dynamic";

type AdvisoryDetailRouteProps = {
  params: Promise<{
    advisoryId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: AdvisoryDetailRouteProps,
) {
  const { advisoryId } = await params;
  const payload = await getSecurityAdvisoryDetail(getDb(), advisoryId);

  if (!payload) {
    return NextResponse.json(
      {
        error: "Advisory not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json(payload);
}
