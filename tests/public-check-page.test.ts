import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("public check page scaffolding", () => {
  it("adds a public check entry to the homepage header and removes the admin security nav item", () => {
    const publicHeader = fs.readFileSync("apps/web/components/public-header.tsx", "utf8")
    const adminNav = fs.readFileSync("apps/web/components/admin/admin-nav.tsx", "utf8")
    const routePath = "apps/web/app/[lang]/check/page.tsx"

    expect(publicHeader).toContain('{ label: "Check"')
    expect(publicHeader).toContain('item.label === "Check"')
    expect(publicHeader).toContain('`/${currentLang}/check`')
    expect(adminNav).not.toContain('href: "/admin/security"')
    expect(fs.existsSync(routePath)).toBe(true)
  })

  it("renders the public check page with the shared header and package-check workbench", () => {
    const route = fs.readFileSync("apps/web/app/[lang]/check/page.tsx", "utf8")
    const componentPath = "apps/web/components/security/package-check-workbench.tsx"

    expect(fs.existsSync(componentPath)).toBe(true)

    const component = fs.readFileSync(componentPath, "utf8")

    expect(route).toContain("PublicHeader")
    expect(route).toContain("PackageCheckWorkbench")
    expect(route).toContain("<PackageCheckWorkbench lang={lang} />")
    expect(component).toContain('fetch("/api/security/check/packages"')
    expect(component).toContain("buildSecurityCheckRequestBody")
    expect(component).toContain("parseSecurityCheckPayload")
    expect(component).toContain("setResult(null)")
    expect(component).toContain("publicCheckSubmit")
    expect(component).toContain("publicCheckSubmitting")
    expect(component).toContain("publicCheckEmpty")
    expect(component).toContain("publicCheckVersionHint")
    expect(component).toContain("publicCheckResultLabel")
    expect(component).toContain("publicCheckSummaryLabel")
    expect(component).toContain("publicCheckDetailsLabel")
    expect(component).toContain("publicCheckDetailsToggle")
    expect(component).toContain("publicCheckDetailsCollapse")
    expect(component).toContain("ChevronRight")
    expect(component).toContain("ChevronDown")
    expect(component).toContain("items-center justify-between")
    expect(component).toContain("publicCheckAffectedVersionsLabel")
    expect(component).toContain("publicCheckAffectedRangesLabel")
    expect(component).toContain("result?.warning")
    expect(component).toContain("publicCheckNoFindings")
    expect(component).toContain("finding.advisory.summary")
    expect(component).toContain("finding.advisory.details")
    expect(component).toContain("MarkdownSummary")
    expect(component).toContain("MarkdownRenderer")
    expect(component).toContain("buildSummaryPreviewText")
    expect(component).toContain("line-clamp-2")
    expect(component).toContain("finding.matchSummary")
    expect(component).toContain("finding.matchReason")
    expect(component).toContain("finding.confidence")
    expect(component).toContain("finding.affectedPackage.affectedVersions")
    expect(component).toContain("formatAffectedRanges")
    expect(component).toContain("finding.affectedPackage.fixedVersions")
    expect(component).toContain("finding.advisory.references")
    expect(component).not.toContain('<li key={reference.url}')
  })

  it("adds public-facing copy for version guidance and result sections", () => {
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8")

    expect(copy).toContain('publicCheckVersionHint: "可选，填写后会返回更精确的命中结果。"')
    expect(copy).toContain('publicCheckResultLabel: "查询结果"')
    expect(copy).toContain('publicCheckSummaryLabel: "简短说明"')
    expect(copy).toContain('publicCheckDetailsLabel: "详细说明"')
    expect(copy).toContain('publicCheckDetailsToggle: "展开详细说明"')
    expect(copy).toContain('publicCheckDetailsCollapse: "收起详细说明"')
    expect(copy).toContain('publicCheckAffectedVersionsLabel: "受影响版本"')
    expect(copy).toContain('publicCheckAffectedRangesLabel: "受影响范围"')
    expect(copy).toContain('publicCheckVersionHint: "Optional. Add a version to get a more precise match result."')
    expect(copy).toContain('publicCheckResultLabel: "Result"')
    expect(copy).toContain('publicCheckSummaryLabel: "Summary"')
    expect(copy).toContain('publicCheckDetailsLabel: "Details"')
    expect(copy).toContain('publicCheckDetailsToggle: "Expand full details"')
    expect(copy).toContain('publicCheckDetailsCollapse: "Collapse full details"')
    expect(copy).toContain('publicCheckAffectedVersionsLabel: "Affected versions"')
    expect(copy).toContain('publicCheckAffectedRangesLabel: "Affected ranges"')
  })
})
