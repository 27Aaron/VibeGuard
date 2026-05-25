import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("public check page scaffolding", () => {
  it("adds a public check entry to the homepage header and removes the admin security nav item", () => {
    const publicHeader = fs.readFileSync(
      "apps/web/components/public-header.tsx",
      "utf8",
    );
    const adminNav = fs.readFileSync(
      "apps/web/components/admin/admin-nav.tsx",
      "utf8",
    );
    const routePath = "apps/web/app/[lang]/check/page.tsx";

    expect(publicHeader).toContain('{ label: "Check"');
    expect(publicHeader).toContain('item.surface === "check"');
    expect(publicHeader).toContain('route: "/check"');
    expect(adminNav).not.toContain('href: "/admin/security"');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("renders the public check page with the shared header and package-check workbench", () => {
    const route = fs.readFileSync("apps/web/app/[lang]/check/page.tsx", "utf8");
    const componentPath =
      "apps/web/components/security/package-check-workbench.tsx";

    expect(fs.existsSync(componentPath)).toBe(true);

    const component = fs.readFileSync(componentPath, "utf8");
    const findingCard = fs.readFileSync(
      "apps/web/components/security/package-check-finding-card.tsx",
      "utf8",
    );
    const pagination = fs.readFileSync(
      "apps/web/components/security/package-check-pagination.tsx",
      "utf8",
    );
    const utils = fs.readFileSync(
      "apps/web/components/security/package-check-utils.ts",
      "utf8",
    );
    const expandable = fs.readFileSync(
      "apps/web/components/security/package-check-expandable-content.tsx",
      "utf8",
    );

    expect(route).toContain("PublicHeader");
    expect(route).toContain("PackageCheckWorkbench");
    expect(route).toContain("PackageCheckWorkbench");
    expect(route).toContain("lang={lang}");
    expect(route).toContain("initialOverviewTotals={overviewTotals}");
    expect(route).not.toContain("publicCheckTitle");
    expect(route).not.toContain("publicCheckDescription");
    expect(component).toContain('fetch("/api/security/check/packages"');
    expect(component).toContain("buildSecurityCheckRequestBody");
    expect(component).toContain("parseCheckResponse");
    expect(utils).toContain("parseSecurityCheckPayload");
    expect(component).toContain("setResult(null)");
    expect(component).toContain("publicCheckSubmit");
    expect(component).toContain("publicCheckSubmitting");
    expect(component).toContain("publicCheckSearchHint");
    expect(component).toContain("publicCheckOverviewBadge");
    expect(component).toContain("publicCheckMatchCountBadge");
    expect(component).toContain("publicCheckHitCountBadge");
    expect(component).not.toContain("const resultBadge");
    expect(component).not.toContain("{resultBadge ? (");
    expect(component).toContain("summaryRiskCount");
    expect(component).toContain("submittedQuery?.version");
    expect(component).toContain(
      "copy.publicCheckMatchCountBadge(matchedCount)",
    );
    expect(component).toContain(
      "copy.publicCheckHitCountBadge(resultSummary.affectedCount)",
    );
    expect(component).toContain("summaryPackageLabel} {summaryRiskCount");
    expect(component).toContain('summaryLineParts.join(" · ")');
    expect(component).toContain("copy.publicCheckResultLabel");
    expect(component).not.toContain('lang === "zh" ? "查询结论"');
    expect(component).toMatch(
      /latestUpdatedAt\s*\?\s*`\$\{lang === "zh" \? "最近漏洞更新"/,
    );
    expect(component).toContain("const findingsPerPage = 3");
    expect(component).toContain("currentPage");
    expect(component).toContain("slice(pageStart, pageEnd)");
    expect(component).toContain(
      "Math.ceil(result.findings.length / findingsPerPage)",
    );
    expect(component).toContain("buildSecurityResultSummary");
    expect(component).not.toContain("formatSecurityMatchReason");
    expect(utils).toContain("getSecurityFindingTone");
    expect(findingCard).toContain("toneBadgeVariant");
    expect(findingCard).toContain("toneLabel");
    expect(findingCard).toContain("getSecurityFindingLatestUpdatedAt");
    expect(findingCard).toContain("findingMetaParts");
    expect(findingCard).toContain("findingMetricBadges");
    expect(component).not.toContain("maliciousPackageOrigins");
    expect(component).not.toContain("maliciousPackageInfo");
    expect(component).not.toContain("maliciousPackageLabel");
    expect(component).not.toContain("maliciousPackageEvidenceItems");
    expect(component).not.toContain("maliciousPackageActionLabel");
    expect(component).not.toContain("处理建议");
    expect(component).not.toContain("建议移除依赖");
    expect(component).not.toContain("Remove the dependency");
    expect(component).not.toContain("恶意包信息");
    expect(component).not.toContain("来源");
    expect(component).not.toContain('来源" : "Source"');
    expect(component).not.toContain("SHA256");
    expect(component).not.toContain("border-red-500/15 bg-red-50/45");
    expect(utils).toContain("OSV 原始记录");
    expect(findingCard).toContain("withdrawnLabel");
    expect(findingCard).toContain("advisoryRelationItems");
    expect(findingCard).toContain("关联记录");
    expect(utils).toContain("已撤回");
    expect(utils).toContain("不再适用");
    expect(findingCard).toContain("cvssLevelFromScore");
    expect(findingCard).toContain("cvssLevelBadgeClassName");
    expect(findingCard).toContain("cvssLevelLabel");
    expect(component).not.toContain("cveBadgeClassName");
    expect(component).toContain("fixedVersionBadgeClassName");
    expect(utils).toContain('variant: "secondary" as const');
    expect(utils).toContain('className: ""');
    expect(component).not.toContain("summaryCvssLevel");
    expect(component).not.toContain("最高 CVSS");
    expect(component).not.toContain("highestCvssScore ? (");
    expect(component).not.toContain(
      "riskLevelLabel(resultSummary.highestRisk.level",
    );
    expect(findingCard).toContain("参考链接");
    expect(component).not.toContain("publicCheckSummaryLabel");
    expect(findingCard).toContain("publicCheckDetailsLabel");
    expect(findingCard).toContain("publicCheckDetailsToggle");
    expect(findingCard).toContain("publicCheckDetailsCollapse");
    expect(pagination).toContain("ChevronRight");
    expect(component).toContain("ChevronDown");
    expect(component).not.toContain("publicCheckAffectedVersionsLabel");
    expect(findingCard).toContain("publicCheckAffectedRangesLabel");
    expect(component).toContain("publicCheckNoFindings");
    expect(findingCard).toContain("finding.advisory.summary");
    expect(findingCard).toContain("finding.advisory.details");
    expect(findingCard).toContain("MarkdownSummary");
    expect(expandable).toContain("MarkdownRenderer");
    expect(expandable).toContain("buildSummaryPreviewText");
    expect(expandable).toContain("line-clamp-2");
    expect(component).not.toContain("expanded || (measured && !canExpand)");
    expect(findingCard).toContain("finding.matchSummary");
    expect(component).not.toContain("finding.matchReason");
    expect(component).not.toContain("finding.confidence");
    expect(findingCard).toContain("finding.affectedPackage.affectedVersions");
    expect(findingCard).toContain("formatAffectedRanges");
    expect(findingCard).toContain("finding.affectedPackage.fixedVersions");
    expect(utils).toContain("finding.advisory.references");
    expect(component).not.toContain("<details");
    expect(component).not.toContain("<summary");
    expect(component).not.toContain("bestCvssSeverity");
    expect(component).not.toContain("cvss-severity");
    expect(findingCard).toContain("bestCvssScore");
    expect(utils).toContain("epssPercentile");
    expect(findingCard).toContain("修复版本");
    expect(component).toContain("className={fixedVersionBadgeClassName()}");
    expect(component).not.toContain(
      "resultSummary.recommendedFixedVersions.slice(0, 6)",
    );
    expect(component).not.toContain(
      "resultSummary.recommendedFixedVersions.length > 6",
    );
    expect(component).toContain(
      "rounded-[1.35rem] border border-black/5 bg-white/70 p-3",
    );
    expect(component).toContain('type="search"');
    expect(component).toContain("Search className");
    expect(component).toContain("buttonVariants");
    expect(component).toContain("resetSearchState");
    expect(component).toContain('setPackageName("")');
    expect(component).toContain('setVersion("")');
    expect(component).toContain("setResult(null)");
    expect(component).toContain("selectOpen");
    expect(component).toContain('role="listbox"');
    expect(component).toContain('aria-haspopup="listbox"');
    expect(component).toContain("lg:w-[208px]");
    expect(component).not.toContain("getAdminSelectClassName");
    expect(component).not.toContain("<select");
    expect(component).not.toContain("<Card>");
    expect(component).not.toContain("publicCheckEmpty");
    expect(component).not.toContain("<li key={reference.url}");
  });

  it("adds public-facing copy for result sections without a long query explainer", () => {
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8");

    expect(copy).not.toContain('publicCheckTitle: "包查询"');
    expect(copy).not.toContain(
      'publicCheckDescription: "选择生态并输入包名即可查询。填写版本号时会返回更细的命中结果。"',
    );
    expect(copy).toContain(
      'publicCheckSearchHint: "搜索你想查询的软件包，填写版本可获得更精确结果。"',
    );
    expect(copy).toContain("publicCheckOverviewBadge:");
    expect(copy).toContain("publicCheckMatchCountBadge:");
    expect(copy).toContain("publicCheckHitCountBadge:");
    expect(copy).toContain("匹配 ${count} 个风险");
    expect(copy).toContain("命中 ${count} 个已知风险");
    expect(copy).toContain("publicCheckPageStatus:");
    expect(copy).toContain('publicCheckResultLabel: "查询结果"');
    expect(copy).toContain('publicCheckSummaryLabel: "简短说明"');
    expect(copy).toContain('publicCheckDetailsLabel: "详细说明"');
    expect(copy).toContain('publicCheckDetailsToggle: "展开详细说明"');
    expect(copy).toContain('publicCheckDetailsCollapse: "收起详细说明"');
    expect(copy).toContain('publicCheckAffectedVersionsLabel: "受影响版本"');
    expect(copy).toContain('publicCheckAffectedRangesLabel: "影响范围"');
    expect(copy).not.toContain('publicCheckTitle: "Package check"');
    expect(copy).not.toContain("publicCheckDescription:");
    expect(copy).toMatch(
      /publicCheckSearchHint:\s*"Search the package you want to check\. Add a version for a more precise result\."/,
    );
    expect(copy).toContain("publicCheckOverviewBadge:");
    expect(copy).toContain("publicCheckMatchCountBadge:");
    expect(copy).toContain("publicCheckHitCountBadge:");
    expect(copy).toContain("matched ${count} risks");
    expect(copy).toContain("hit ${count} known risks");
    expect(copy).toContain("publicCheckPageStatus:");
    expect(copy).toContain('publicCheckResultLabel: "Result"');
    expect(copy).toContain('publicCheckSummaryLabel: "Summary"');
    expect(copy).toContain('publicCheckDetailsLabel: "Details"');
    expect(copy).toContain('publicCheckDetailsToggle: "Expand full details"');
    expect(copy).toContain(
      'publicCheckDetailsCollapse: "Collapse full details"',
    );
    expect(copy).toContain(
      'publicCheckAffectedVersionsLabel: "Affected versions"',
    );
    expect(copy).toContain('publicCheckAffectedRangesLabel: "Affected ranges"');
    expect(copy).not.toContain("publicCheckFootnote:");
  });
});
