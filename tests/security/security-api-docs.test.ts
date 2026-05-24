import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("security API documentation", () => {
  const openapi = fs.readFileSync("apps/web/public/openapi.yaml", "utf8");
  const openapiZh = fs.readFileSync("apps/web/public/openapi.zh.yaml", "utf8");
  const openapiEn = fs.readFileSync("apps/web/public/openapi.en.yaml", "utf8");
  const apiPage = fs.readFileSync("apps/web/app/[lang]/api/page.tsx", "utf8");
  const openapiRoute = fs.readFileSync(
    "apps/web/app/[lang]/openapi/route.ts",
    "utf8",
  );

  it("ships localized OpenAPI documents and keeps the default Chinese-compatible alias", () => {
    expect(openapiZh).toContain("title: VibeGuard Public API");
    expect(openapiZh).toContain("公开站点概览");
    expect(openapiZh).toContain("批量检查依赖包是否存在已知安全漏洞");
    expect(openapiZh).toContain("x-codeSamples:");

    expect(openapiEn).toContain("title: VibeGuard Public API");
    expect(openapiEn).toContain("Public site overview");
    expect(openapiEn).toContain(
      "Batch check package coordinates against the local security mirror",
    );
    expect(openapiEn).toContain("x-codeSamples:");

    expect(openapi).toContain("公开站点概览");
  });

  it("serves the OpenAPI document that matches the localized route", () => {
    expect(openapiRoute).toContain("resolveLang");
    expect(openapiRoute).toContain("`openapi.${lang}.yaml`");
  });

  it("documents the expanded security API routes in OpenAPI", () => {
    expect(openapi).toContain("/api/security/advisories:");
    expect(openapi).toContain("/api/security/advisories/{advisoryId}:");
    expect(openapi).toContain(
      "/api/security/packages/{ecosystem}/{packageName}:",
    );
    expect(openapi).toContain("/api/security/cves/{cveId}:");
    expect(openapi).toContain("/api/security/sync/status:");
  });

  it("documents package-check enrichment fields in OpenAPI", () => {
    expect(openapi).toContain("confidence:");
    expect(openapi).toContain("matchReason:");
    expect(openapi).toContain("withdrawnAt:");
    expect(openapi).toContain("related:");
    expect(openapi).toContain("upstream:");
    expect(openapi).toContain("maliciousOrigins:");
    expect(openapi).toContain("cvssMetrics:");
    expect(openapi).toContain("epssScoreDate:");
    expect(openapi).toContain("kevDateAdded:");
    expect(openapi).toContain("nvdModifiedAt:");
  });

  it("shows the new API routes on the public API page", () => {
    expect(apiPage).toContain('path="/api/security/advisories"');
    expect(apiPage).toContain('path="/api/security/advisories/{id}"');
    expect(apiPage).toContain(
      'path="/api/security/packages/{ecosystem}/{name}"',
    );
    expect(apiPage).toContain('path="/api/security/cves/{id}"');
    expect(apiPage).toContain('path="/api/security/sync/status"');
  });
});
