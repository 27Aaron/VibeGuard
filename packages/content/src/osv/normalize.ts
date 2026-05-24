import {
  SecurityPackageEcosystem,
  SecurityRiskType,
  type SecurityPackageEcosystem as SecurityPackageEcosystemValue,
  type SecurityRiskType as SecurityRiskTypeValue,
} from "@vibeguard/shared";

type OsvSeverity = {
  type?: string;
  score?: string;
};

type OsvReference = {
  type?: string;
  url?: string;
};

type OsvRange = {
  type?: string;
  repo?: string;
  events?: Array<Record<string, string>>;
  database_specific?: Record<string, unknown>;
};

type OsvAffected = {
  package?: {
    name?: string;
    ecosystem?: string;
    purl?: string;
  };
  severity?: OsvSeverity[];
  ranges?: OsvRange[];
  versions?: string[];
};

export type OsvVulnerability = {
  schema_version?: string;
  id?: string;
  modified?: string;
  published?: string;
  withdrawn?: string;
  aliases?: string[];
  related?: string[];
  upstream?: string[];
  summary?: string;
  details?: string;
  severity?: OsvSeverity[];
  affected?: OsvAffected[];
  references?: OsvReference[];
  database_specific?: Record<string, unknown>;
};

type NormalizeOsvRecordOptions = {
  sourceUrl: string;
  rawHash?: string;
};

export type NormalizedOsvAdvisory = {
  source: "osv";
  externalId: string;
  sourceUrl: string;
  rawHash: string | null;
  riskType: SecurityRiskTypeValue;
  summary: string;
  details: string | null;
  aliases: string[];
  severity: OsvSeverity[];
  publishedAt: Date | null;
  modifiedAt: Date | null;
  withdrawnAt: Date | null;
  relatedIds: string[];
  upstreamIds: string[];
  references: Array<{ type?: string; url: string }>;
  maliciousOrigins: NormalizedMaliciousPackageOrigin[];
};

export type NormalizedMaliciousPackageOrigin = {
  id?: string;
  source?: string;
  importTime?: string;
  modifiedTime?: string;
  versions: string[];
  sha256?: string;
};

export type NormalizedOsvAffectedPackage = {
  ecosystem: SecurityPackageEcosystemValue;
  packageName: string;
  packageKey: string;
  purl: string | null;
  affectedVersions: string[];
  ranges: OsvRange[];
  fixedVersions: string[];
};

export type NormalizedOsvRecord = {
  advisory: NormalizedOsvAdvisory;
  affectedPackages: NormalizedOsvAffectedPackage[];
};

export function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(
      value,
    )
  ) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function normalizeOsvPackageEcosystem(
  ecosystem: string,
): SecurityPackageEcosystemValue | null {
  switch (ecosystem) {
    case "npm":
      return SecurityPackageEcosystem.NPM;
    case "PyPI":
      return SecurityPackageEcosystem.PYPI;
    case "Go":
      return SecurityPackageEcosystem.GO;
    case "crates.io":
      return SecurityPackageEcosystem["CRATES-IO"];
    default:
      return null;
  }
}

export function normalizeOsvPackageKey(ecosystem: string, packageName: string) {
  const trimmed = packageName.trim();

  if (ecosystem === "PyPI") {
    return trimmed.toLowerCase().replace(/[-_.]+/g, "-");
  }

  if (ecosystem === "npm" || ecosystem === "crates.io") {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

function inferRiskType(
  vulnerability: OsvVulnerability,
  maliciousOrigins: NormalizedMaliciousPackageOrigin[],
): SecurityRiskTypeValue {
  if (/^MAL-/i.test(vulnerability.id ?? "") || maliciousOrigins.length > 0) {
    return SecurityRiskType["MALICIOUS-PACKAGE"];
  }

  return SecurityRiskType.VULNERABILITY;
}

function normalizeReferences(references: OsvReference[] | undefined) {
  return (references ?? []).flatMap((reference) => {
    if (!reference.url) {
      return [];
    }

    return [
      {
        type: reference.type,
        url: reference.url,
      },
    ];
  });
}

function fixedVersionsFromRanges(ranges: OsvRange[] | undefined) {
  return uniqueStrings(
    (ranges ?? []).flatMap((range) =>
      (range.events ?? []).map((event) => event.fixed),
    ),
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeDetails(value: string | undefined) {
  const details = value?.trim();

  if (!details) {
    return null;
  }

  const withoutSourceMarker = details
    .replace(/^---\s*/u, "")
    .replace(/_-= Per source details\. Do not edit below this line\.=-_/gu, "")
    .trim();

  return withoutSourceMarker ? details : null;
}

function normalizeMaliciousOrigins(
  databaseSpecific: Record<string, unknown> | undefined,
): NormalizedMaliciousPackageOrigin[] {
  const origins = databaseSpecific?.["malicious-packages-origins"];

  if (!Array.isArray(origins)) {
    return [];
  }

  return origins.flatMap((origin) => {
    if (!origin || typeof origin !== "object" || Array.isArray(origin)) {
      return [];
    }

    const record = origin as Record<string, unknown>;
    const versions = uniqueStrings(
      Array.isArray(record.versions)
        ? record.versions.map((version) =>
            typeof version === "string" ? version : undefined,
          )
        : [],
    );

    return [
      {
        id: stringValue(record.id),
        source: stringValue(record.source),
        importTime: stringValue(record.import_time),
        modifiedTime: stringValue(record.modified_time),
        versions,
        sha256: stringValue(record.sha256),
      },
    ];
  });
}

function normalizeAffectedPackages(affected: OsvAffected[] | undefined) {
  const packagesByKey = new Map<string, NormalizedOsvAffectedPackage>();

  for (const affectedPackage of affected ?? []) {
    const packageName = affectedPackage.package?.name?.trim();
    const osvEcosystem = affectedPackage.package?.ecosystem?.trim();

    if (!packageName || !osvEcosystem) {
      continue;
    }

    const ecosystem = normalizeOsvPackageEcosystem(osvEcosystem);

    if (!ecosystem) {
      continue;
    }

    const packageKey = normalizeOsvPackageKey(osvEcosystem, packageName);
    const mapKey = `${ecosystem}\0${packageKey}`;
    const existing = packagesByKey.get(mapKey);
    const ranges = affectedPackage.ranges ?? [];
    const fixedVersions = fixedVersionsFromRanges(ranges);

    if (existing) {
      existing.affectedVersions = uniqueStrings([
        ...existing.affectedVersions,
        ...(affectedPackage.versions ?? []),
      ]);
      existing.ranges = [...existing.ranges, ...ranges];
      existing.fixedVersions = uniqueStrings([
        ...existing.fixedVersions,
        ...fixedVersions,
      ]);
      existing.purl = existing.purl ?? affectedPackage.package?.purl ?? null;
      continue;
    }

    packagesByKey.set(mapKey, {
      ecosystem,
      packageName,
      packageKey,
      purl: affectedPackage.package?.purl ?? null,
      affectedVersions: uniqueStrings(affectedPackage.versions ?? []),
      ranges,
      fixedVersions,
    });
  }

  return Array.from(packagesByKey.values());
}

export function normalizeOsvRecord(
  vulnerability: OsvVulnerability,
  options: NormalizeOsvRecordOptions,
): NormalizedOsvRecord {
  if (!vulnerability.id) {
    throw new Error("OSV vulnerability id is required");
  }

  const maliciousOrigins = normalizeMaliciousOrigins(
    vulnerability.database_specific,
  );

  return {
    advisory: {
      source: "osv",
      externalId: vulnerability.id,
      sourceUrl: options.sourceUrl,
      rawHash: options.rawHash ?? null,
      riskType: inferRiskType(vulnerability, maliciousOrigins),
      summary: vulnerability.summary ?? "",
      details: normalizeDetails(vulnerability.details),
      aliases: uniqueStrings(vulnerability.aliases ?? []),
      relatedIds: uniqueStrings(vulnerability.related ?? []),
      upstreamIds: uniqueStrings(vulnerability.upstream ?? []),
      severity: vulnerability.severity ?? [],
      publishedAt: parseDate(vulnerability.published),
      modifiedAt: parseDate(vulnerability.modified),
      withdrawnAt: parseDate(vulnerability.withdrawn),
      references: normalizeReferences(vulnerability.references),
      maliciousOrigins,
    },
    affectedPackages: normalizeAffectedPackages(vulnerability.affected),
  };
}
