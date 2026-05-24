import type { SecurityPackageMatchConfidence } from "@vibeguard/shared";

export type SecurityRiskLevel =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "unknown";

export type SecurityRiskSignal =
  | "affected_version_match"
  | "package_match_without_version"
  | "cisa_kev"
  | "ransomware_campaign"
  | "epss_high_percentile"
  | "epss_elevated_percentile"
  | "cvss_critical"
  | "cvss_high"
  | "no_fixed_version"
  | "fixed_version_available";

export type SecurityCveRiskInput = {
  cveId: string;
  bestCvssScore?: string | number | null;
  bestCvssSeverity?: string | null;
  epss?: string | number | null;
  epssPercentile?: string | number | null;
  kevListed?: boolean | null;
  kevKnownRansomwareCampaignUse?: string | null;
};

export type SecurityFindingRiskInput = {
  affected: boolean;
  confidence: SecurityPackageMatchConfidence;
  fixedVersions: string[];
  cveEnrichments: SecurityCveRiskInput[];
};

export type SecurityFindingRisk = {
  level: SecurityRiskLevel;
  score: number;
  signals: SecurityRiskSignal[];
};

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function riskLevel(score: number): SecurityRiskLevel {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function hasKnownRansomwareUse(value: string | null | undefined) {
  return typeof value === "string" && value.toLowerCase() === "known";
}

export function extractCveAliases(aliases: string[]) {
  return Array.from(
    new Set(
      aliases
        .map((alias) => alias.trim().toUpperCase())
        .filter((alias) => /^CVE-\d{4}-\d{4,}$/i.test(alias)),
    ),
  );
}

export function calculateSecurityFindingRisk({
  affected,
  confidence,
  fixedVersions,
  cveEnrichments,
}: SecurityFindingRiskInput): SecurityFindingRisk {
  const signals = new Set<SecurityRiskSignal>();
  let score = 0;

  if (affected) {
    signals.add("affected_version_match");
    score += 40;
  } else if (confidence === "low") {
    signals.add("package_match_without_version");
    score += 20;
  }

  if (fixedVersions.length > 0) {
    signals.add("fixed_version_available");
  } else {
    signals.add("no_fixed_version");
    score += 8;
  }

  const maxCvss = Math.max(
    0,
    ...cveEnrichments.flatMap((entry) => {
      const parsed = toNumber(entry.bestCvssScore);
      return parsed === null ? [] : [parsed];
    }),
  );

  if (maxCvss >= 9) {
    signals.add("cvss_critical");
    score += 20;
  } else if (maxCvss >= 7) {
    signals.add("cvss_high");
    score += 12;
  }

  const maxEpssPercentile = Math.max(
    0,
    ...cveEnrichments.flatMap((entry) => {
      const parsed = toNumber(entry.epssPercentile);
      return parsed === null ? [] : [parsed];
    }),
  );

  if (maxEpssPercentile >= 0.95) {
    signals.add("epss_high_percentile");
    score += 20;
  } else if (maxEpssPercentile >= 0.9) {
    signals.add("epss_elevated_percentile");
    score += 15;
  }

  if (cveEnrichments.some((entry) => entry.kevListed)) {
    signals.add("cisa_kev");
    score += 35;
  }

  if (
    cveEnrichments.some((entry) =>
      hasKnownRansomwareUse(entry.kevKnownRansomwareCampaignUse),
    )
  ) {
    signals.add("ransomware_campaign");
    score += 20;
  }

  const normalizedScore = Math.max(0, Math.min(100, score));

  return {
    level: riskLevel(normalizedScore),
    score: normalizedScore,
    signals: Array.from(signals),
  };
}
