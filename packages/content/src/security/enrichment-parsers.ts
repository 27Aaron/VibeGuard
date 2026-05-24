import type { SecurityCveEnrichmentPatch } from "./enrichment-types";
import { NVD_FEED_BASE_URL, NVD_MODIFIED_FEED_URL } from "./enrichment-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDecimalString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? value.trim() : null;
  }

  return null;
}

function parseDate(value: unknown) {
  const text = toStringOrNull(value);
  if (!text) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00.000Z`
    : text.endsWith("Z")
      ? text
      : `${text}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function isCveId(value: unknown): value is string {
  return typeof value === "string" && /^CVE-\d{4}-\d{4,}$/i.test(value.trim());
}

function normalizeCveId(value: string) {
  return value.trim().toUpperCase();
}

function firstEnglishDescription(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    if (
      isRecord(item) &&
      item.lang === "en" &&
      typeof item.value === "string" &&
      item.value.trim()
    ) {
      return item.value.trim();
    }
  }

  return null;
}

export function buildNvdModifiedFeedUrl() {
  return NVD_MODIFIED_FEED_URL;
}

export function buildNvdYearFeedUrl(year: number) {
  return `${NVD_FEED_BASE_URL}/nvdcve-2.0-${year}.json.gz`;
}

export function parseKevCatalog(rawJson: string): SecurityCveEnrichmentPatch[] {
  const parsed = JSON.parse(rawJson);
  if (!isRecord(parsed) || !Array.isArray(parsed.vulnerabilities)) {
    throw new Error("Invalid CISA KEV catalog payload.");
  }

  return parsed.vulnerabilities.flatMap((entry) => {
    if (!isRecord(entry) || !isCveId(entry.cveID)) {
      return [];
    }

    return {
      cveId: normalizeCveId(entry.cveID),
      title: toStringOrNull(entry.vulnerabilityName),
      description: toStringOrNull(entry.shortDescription),
      cweIds: Array.isArray(entry.cwes)
        ? uniqueStrings(entry.cwes.map((value) => toStringOrNull(value)))
        : [],
      kevListed: true,
      kevDateAdded: parseDate(entry.dateAdded),
      kevDueDate: parseDate(entry.dueDate),
      kevKnownRansomwareCampaignUse: toStringOrNull(
        entry.knownRansomwareCampaignUse,
      ),
      kevRequiredAction: toStringOrNull(entry.requiredAction),
      kevVendorProject: toStringOrNull(entry.vendorProject),
      kevProduct: toStringOrNull(entry.product),
      kevNotes: toStringOrNull(entry.notes),
    };
  });
}

export function parseEpssCsv(csv: string): SecurityCveEnrichmentPatch[] {
  const lines = csv.split(/\r?\n/);
  const firstComment = lines.find((line) => line.startsWith("#")) ?? "";
  const modelVersion =
    firstComment.match(/model_version:([^,\s]+)/)?.[1]?.trim() ?? null;
  const scoreDate = parseDate(
    firstComment.match(/score_date:([^,\s]+)/)?.[1]?.trim(),
  );
  const dataLines = lines.filter(
    (line) => line.trim() && !line.startsWith("#"),
  );
  const header = dataLines.shift()?.trim();

  if (header !== "cve,epss,percentile") {
    throw new Error("Invalid FIRST EPSS CSV header.");
  }

  return dataLines.flatMap((line) => {
    const [cve, epss, percentile] = line.split(",");
    if (!isCveId(cve)) {
      return [];
    }

    return {
      cveId: normalizeCveId(cve),
      epss: toDecimalString(epss),
      epssPercentile: toDecimalString(percentile),
      epssScoreDate: scoreDate,
      epssModelVersion: modelVersion,
    };
  });
}

export function normalizeCvssMetric(source: string, metric: unknown) {
  if (!isRecord(metric) || !isRecord(metric.cvssData)) {
    return null;
  }

  const cvssData = metric.cvssData;
  const baseScore = toDecimalString(cvssData.baseScore);
  const baseSeverity = toStringOrNull(cvssData.baseSeverity);

  return {
    source: "nvd",
    version:
      toStringOrNull(cvssData.version) ?? source.replace("cvssMetricV", ""),
    vector: toStringOrNull(cvssData.vectorString) ?? undefined,
    baseScore: baseScore ?? undefined,
    baseSeverity: baseSeverity ?? undefined,
    exploitabilityScore:
      toDecimalString(metric.exploitabilityScore) ?? undefined,
    impactScore: toDecimalString(metric.impactScore) ?? undefined,
  };
}

export function extractCvssMetrics(metrics: unknown) {
  if (!isRecord(metrics)) {
    return [];
  }

  return Object.entries(metrics).flatMap(([key, value]) => {
    if (!Array.isArray(value) || !key.startsWith("cvssMetric")) {
      return [];
    }

    return value.flatMap((metric) => normalizeCvssMetric(key, metric) ?? []);
  });
}

export function selectBestCvssMetric(
  cvssMetrics: ReturnType<typeof extractCvssMetrics>,
) {
  return [...cvssMetrics].sort((left, right) => {
    const leftScore = Number.parseFloat(left.baseScore ?? "0");
    const rightScore = Number.parseFloat(right.baseScore ?? "0");
    return rightScore - leftScore;
  })[0];
}

function extractCweIds(weaknesses: unknown) {
  if (!Array.isArray(weaknesses)) {
    return [];
  }

  return uniqueStrings(
    weaknesses.flatMap((weakness) => {
      if (!isRecord(weakness) || !Array.isArray(weakness.description)) {
        return [];
      }

      return weakness.description.flatMap((description) => {
        if (
          isRecord(description) &&
          typeof description.value === "string" &&
          /^CWE-\d+$/i.test(description.value.trim())
        ) {
          return description.value.trim().toUpperCase();
        }

        return [];
      });
    }),
  );
}

export function parseNvdModifiedFeed(
  payload: unknown,
): SecurityCveEnrichmentPatch[] {
  if (!isRecord(payload) || !Array.isArray(payload.vulnerabilities)) {
    throw new Error("Invalid NVD modified feed payload.");
  }

  return payload.vulnerabilities.flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.cve) || !isCveId(entry.cve.id)) {
      return [];
    }

    const cve = entry.cve;
    const cveId = typeof cve.id === "string" ? cve.id : "";
    const cvssMetrics = extractCvssMetrics(cve.metrics);
    const bestCvss = selectBestCvssMetric(cvssMetrics);
    const description = firstEnglishDescription(cve.descriptions);

    return {
      cveId: normalizeCveId(cveId),
      title: description ? description.split(".")[0] : null,
      description,
      cvssMetrics,
      bestCvssScore: bestCvss?.baseScore ?? null,
      bestCvssSeverity: bestCvss?.baseSeverity ?? null,
      cweIds: extractCweIds(cve.weaknesses),
      nvdPublishedAt: parseDate(cve.published),
      nvdModifiedAt: parseDate(cve.lastModified),
    };
  });
}
