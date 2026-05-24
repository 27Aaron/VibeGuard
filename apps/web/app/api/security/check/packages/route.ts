import { NextResponse } from "next/server";

import { checkPackagesAgainstLocalDb } from "@vibeguard/content/osv/query";
import { getDb } from "@vibeguard/db";

import { parseSecurityPackageCheckBody } from "../../../../../lib/api-security";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const packageCheckRateLimits = new Map<
  string,
  { count: number; windowStart: number }
>();

const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = 0;

function cleanupExpiredEntries(now: number) {
  if (now - lastCleanup < RATE_LIMIT_CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [ip, entry] of packageCheckRateLimits) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      packageCheckRateLimits.delete(ip);
    }
  }
}

function resolveClientIp(request: Request): string {
  const trustProxy = process.env.VIBEGUARD_TRUST_PROXY_HEADERS?.toLowerCase();
  if (trustProxy === "1" || trustProxy === "true") {
    const forwarded = request.headers.get("x-forwarded-for");
    const candidate = forwarded?.split(",")[0]?.trim();
    if (candidate) return candidate;

    const realIp = request.headers.get("x-real-ip");
    if (realIp?.trim()) return realIp.trim();
  }

  return "local";
}

function isRateLimited(ip: string, now = Date.now()): boolean {
  cleanupExpiredEntries(now);
  const entry = packageCheckRateLimits.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    packageCheckRateLimits.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(request: Request) {
  const clientIp = resolveClientIp(request);

  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const parsed = parseSecurityPackageCheckBody(body);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.message,
      },
      { status: 400 },
    );
  }

  const payload = await checkPackagesAgainstLocalDb(getDb(), {
    packages: parsed.packages,
  });

  return NextResponse.json(payload);
}
