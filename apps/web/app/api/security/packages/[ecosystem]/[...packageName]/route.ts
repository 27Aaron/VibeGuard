import { NextResponse } from "next/server";

import { getDb } from "@vibeguard/db";
import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared";

import { getSecurityPackageProfile } from "../../../../../../lib/security-api";

export const dynamic = "force-dynamic";

type PackageProfileRouteProps = {
  params: Promise<{
    ecosystem: string;
    packageName: string[];
  }>;
};

function isSupportedEcosystem(
  value: string,
): value is SecurityPackageEcosystem {
  return SECURITY_PACKAGE_ECOSYSTEM_VALUES.includes(
    value as SecurityPackageEcosystem,
  );
}

export async function GET(
  request: Request,
  { params }: PackageProfileRouteProps,
) {
  const { ecosystem, packageName } = await params;

  if (!isSupportedEcosystem(ecosystem)) {
    return NextResponse.json(
      {
        ok: false,
        message: `ecosystem must be one of ${SECURITY_PACKAGE_ECOSYSTEM_VALUES.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const name = packageName.join("/").trim();

  if (!name) {
    return NextResponse.json(
      { ok: false, message: "package name is required." },
      { status: 400 },
    );
  }

  if (name.length > 256) {
    return NextResponse.json(
      { ok: false, message: "package name too long." },
      { status: 400 },
    );
  }

  const rawVersion =
    new URL(request.url).searchParams.get("version")?.trim() || null;
  const version =
    rawVersion && rawVersion.length <= 128 ? rawVersion : null;
  const payload = await getSecurityPackageProfile(getDb(), {
    ecosystem,
    name,
    version,
  });

  return NextResponse.json(payload);
}
