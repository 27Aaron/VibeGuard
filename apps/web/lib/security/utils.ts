import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  SECURITY_RISK_TYPE_VALUES,
  type SecurityPackageEcosystem,
  type SecurityRiskType,
} from "@vibeguard/shared";

import {
  SECURITY_API_DEFAULT_LIMIT,
  SECURITY_API_MAX_LIMIT,
  type SecurityAdvisoryListParams,
} from "./constants";

export { normalizeSecurityCveId };

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function optionalNumber(raw: string | null) {
  if (!raw?.trim()) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalBoolean(raw: string | null) {
  if (raw === null) return null;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return null;
}

function optionalDateIso(raw: string | null) {
  if (!raw?.trim()) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function isSupportedEcosystem(
  value: string,
): value is SecurityPackageEcosystem {
  return SECURITY_PACKAGE_ECOSYSTEM_VALUES.includes(
    value as SecurityPackageEcosystem,
  );
}

function isSupportedRiskType(value: string): value is SecurityRiskType {
  return SECURITY_RISK_TYPE_VALUES.includes(value as SecurityRiskType);
}

function clampStringLength(raw: string, max: number) {
  return raw.length > max ? raw.slice(0, max) : raw;
}

function normalizeSecurityCveId(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^CVE-\d{4}-\d{4,}$/.test(normalized) ? normalized : null;
}

export function parseSecurityAdvisoryListParams(
  searchParams: URLSearchParams,
): SecurityAdvisoryListParams {
  const ecosystemParam = searchParams.get("ecosystem")?.trim() ?? "";
  const riskTypeParam = searchParams.get("riskType")?.trim() ?? "";

  return {
    q: clampStringLength(searchParams.get("q")?.trim() ?? "", 256),
    ecosystem: isSupportedEcosystem(ecosystemParam) ? ecosystemParam : null,
    packageName: clampStringLength(searchParams.get("package")?.trim() ?? "", 256),
    cve: normalizeSecurityCveId(searchParams.get("cve") ?? ""),
    riskType: isSupportedRiskType(riskTypeParam) ? riskTypeParam : null,
    kev: optionalBoolean(searchParams.get("kev")),
    withdrawn: optionalBoolean(searchParams.get("withdrawn")),
    cvssMin: optionalNumber(searchParams.get("cvssMin")),
    epssMin: optionalNumber(searchParams.get("epssMin")),
    updatedAfter: optionalDateIso(searchParams.get("updatedAfter")),
    limit: clampInt(
      searchParams.get("limit"),
      SECURITY_API_DEFAULT_LIMIT,
      1,
      SECURITY_API_MAX_LIMIT,
    ),
    page: clampInt(searchParams.get("page"), 1, 1, 10_000),
  };
}

export { SECURITY_API_DEFAULT_LIMIT, SECURITY_API_MAX_LIMIT } from "./constants";

