import type { SecurityPackageEcosystem } from "@vibeguard/shared";

import type { AppLang } from "@/lib/i18n";
import {
  getSecurityFindingTone,
  parseSecurityCheckPayload,
  type SecurityFinding,
} from "@/lib/security-workbench";
import { formatDateTimeInShanghai } from "@/lib/time";

type CvssLevel = "critical" | "high" | "medium" | "low";

export function ecosystemLabel(ecosystem: SecurityPackageEcosystem) {
  switch (ecosystem) {
    case "pypi":
      return "PyPI";
    case "go":
      return "Go";
    case "crates-io":
      return "crates.io";
    default:
      return ecosystem;
  }
}

export function toneBadgeVariant(finding: SecurityFinding) {
  switch (getSecurityFindingTone(finding)) {
    case "hit":
      return "destructive";
    case "withdrawn":
      return "secondary";
    case "inconclusive":
      return "outline";
    case "clear":
      return "secondary";
    default:
      return "outline";
  }
}

export function toneLabel(finding: SecurityFinding, lang: AppLang) {
  switch (getSecurityFindingTone(finding)) {
    case "hit":
      return lang === "zh" ? "已命中" : "Match";
    case "withdrawn":
      return lang === "zh" ? "已撤回" : "Withdrawn";
    case "inconclusive":
      return lang === "zh" ? "待确认" : "Inconclusive";
    case "clear":
      return lang === "zh" ? "未命中" : "Clear";
    default:
      return lang === "zh" ? "结果" : "Result";
  }
}

function formatPercent(value: string | number | null | undefined) {
  if (!value) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? `${Math.round(parsed * 100)}%` : null;
}

function numberFromDecimal(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function formatFindingTime(value: string | null | undefined, lang: AppLang) {
  return value ? formatDateTimeInShanghai(value, { lang }) : null;
}

function primaryCveLabel(finding: SecurityFinding) {
  return (
    finding.cveEnrichments[0]?.cveId ??
    finding.advisory.aliases.find((alias) => alias.startsWith("CVE-")) ??
    null
  );
}

export function primaryCveEnrichment(finding: SecurityFinding) {
  const primaryCve = primaryCveLabel(finding);

  return (
    finding.cveEnrichments.find((cve) => cve.cveId === primaryCve) ??
    finding.cveEnrichments[0]
  );
}

export function cvssLevelFromScore(
  value: string | number | null | undefined,
): CvssLevel | null {
  const score = numberFromDecimal(value);

  if (score === null || score <= 0) return null;
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";

  return "low";
}

export function cvssLevelLabel(level: CvssLevel, lang: AppLang) {
  return lang === "zh"
    ? {
        critical: "严重",
        high: "高危",
        medium: "中危",
        low: "低危",
      }[level]
    : {
        critical: "CRITICAL",
        high: "HIGH",
        medium: "MEDIUM",
        low: "LOW",
      }[level];
}

export function cvssLevelBadgeClassName(level: CvssLevel) {
  switch (level) {
    case "critical":
      return "border-red-500/30 bg-red-50 text-red-700 dark:border-red-300/25 dark:bg-red-400/10 dark:text-red-200";
    case "high":
      return "border-orange-500/30 bg-orange-50 text-orange-700 dark:border-orange-300/25 dark:bg-orange-400/10 dark:text-orange-200";
    case "medium":
      return "border-amber-500/30 bg-amber-50 text-amber-700 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-200";
    case "low":
      return "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-200";
    default:
      return "";
  }
}

export function fixedVersionBadgeClassName() {
  return "h-6 px-2.5 border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-200";
}

export function affectedRangeBadgeClassName() {
  return "h-6 px-2.5";
}

function riskTypeLabel(riskType: string, lang: AppLang) {
  if (riskType === "malicious-package") {
    return lang === "zh" ? "恶意包" : "Malicious package";
  }

  return null;
}

export function findingMetricBadges(finding: SecurityFinding, lang: AppLang) {
  const primaryCve = primaryCveLabel(finding);
  const enrichment = primaryCveEnrichment(finding);
  const epssPercentile = formatPercent(enrichment?.epssPercentile);
  const riskType = riskTypeLabel(finding.advisory.riskType, lang);

  return [
    riskType
      ? {
          key: "risk-type",
          label: riskType,
          variant: "outline" as const,
          className:
            "border-red-500/25 bg-red-50 text-red-700 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-200",
        }
      : null,
    primaryCve
      ? {
          key: "cve",
          label: primaryCve,
          variant: "secondary" as const,
          className: "",
        }
      : null,
    enrichment?.bestCvssScore
      ? {
          key: "cvss-score",
          label: `CVSS ${enrichment.bestCvssScore}`,
          variant: "secondary" as const,
          className: "",
        }
      : null,
    epssPercentile
      ? {
          key: "epss",
          label: `EPSS ${epssPercentile}`,
          variant: "secondary" as const,
          className: "",
        }
      : null,
  ].filter((badge): badge is NonNullable<typeof badge> => Boolean(badge));
}

export function withdrawnLabel(finding: SecurityFinding, lang: AppLang) {
  const withdrawnAt = formatFindingTime(finding.advisory.withdrawnAt, lang);

  if (!withdrawnAt) {
    return null;
  }

  return lang === "zh"
    ? `已撤回 · 不再适用 · 撤回 ${withdrawnAt}`
    : `Withdrawn · No longer applicable · Withdrawn ${withdrawnAt}`;
}

export function relationKindLabel(
  kind: "alias" | "related" | "upstream",
  lang: AppLang,
) {
  if (lang === "zh") {
    return {
      alias: "别名",
      related: "相关",
      upstream: "上游",
    }[kind];
  }

  return {
    alias: "Alias",
    related: "Related",
    upstream: "Upstream",
  }[kind];
}

export function advisoryRelationItems(finding: SecurityFinding) {
  const primaryCve = primaryCveLabel(finding)?.toUpperCase();
  const ignoredIds = new Set(
    [finding.advisory.id.toUpperCase(), primaryCve].filter((id): id is string =>
      Boolean(id),
    ),
  );
  const seenIds = new Set<string>();
  const items: Array<{ id: string; kind: "alias" | "related" | "upstream" }> =
    [];

  function add(
    kind: "alias" | "related" | "upstream",
    ids: string[] | undefined,
  ) {
    for (const id of ids ?? []) {
      const trimmedId = id.trim();
      const normalizedId = trimmedId.toUpperCase();

      if (
        !trimmedId ||
        ignoredIds.has(normalizedId) ||
        seenIds.has(normalizedId)
      ) {
        continue;
      }

      seenIds.add(normalizedId);
      items.push({ id: trimmedId, kind });
    }
  }

  add("upstream", finding.advisory.upstream);
  add("related", finding.advisory.related);
  add("alias", finding.advisory.aliases);

  return items;
}

export function findingReferenceItems(finding: SecurityFinding) {
  const references = [...finding.advisory.references];
  const sourceUrl = finding.advisory.sourceUrl;

  if (!sourceUrl) {
    return references;
  }

  const normalizedSourceUrl = (() => {
    try {
      return new URL(sourceUrl).toString();
    } catch {
      return null;
    }
  })();

  if (
    normalizedSourceUrl &&
    !references.some((reference) => reference.url === normalizedSourceUrl)
  ) {
    references.push({ type: "ADVISORY", url: normalizedSourceUrl });
  }

  return references;
}

export function referenceLabel(
  reference: SecurityFinding["advisory"]["references"][number],
  lang: AppLang,
) {
  const type = reference.type?.toUpperCase();
  let url: URL | null = null;

  try {
    url = new URL(reference.url);
  } catch {
    return type || reference.url;
  }

  const path = url.pathname;

  if (
    url.hostname === "storage.googleapis.com" &&
    path.includes("/osv-vulnerabilities/")
  ) {
    return lang === "zh" ? "OSV 原始记录" : "OSV record";
  }
  if (url.hostname === "nvd.nist.gov") return "NVD";
  if (url.hostname === "github.com" && path.includes("/security/advisories/")) {
    return "GitHub Advisory";
  }
  if (url.hostname === "github.com" && path.includes("/pull/")) {
    return lang === "zh" ? "修复 PR" : "Fix PR";
  }
  if (url.hostname === "github.com" && path.includes("/commit/")) {
    return lang === "zh" ? "修复 Commit" : "Fix commit";
  }
  if (url.hostname === "github.com" && path.includes("/releases/tag/")) {
    return lang === "zh" ? "版本发布" : "Release";
  }
  if (type === "PACKAGE") return lang === "zh" ? "项目主页" : "Package";
  if (type === "ADVISORY") return lang === "zh" ? "公告" : "Advisory";

  return url.hostname.replace(/^www\./, "");
}

export async function parseCheckResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | unknown;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return parseSecurityCheckPayload(payload);
}
