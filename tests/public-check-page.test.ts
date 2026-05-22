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
    expect(component).toContain("result?.warning")
    expect(component).toContain("publicCheckNoFindings")
    expect(component).toContain("finding.matchSummary")
    expect(component).toContain("finding.matchReason")
    expect(component).toContain("finding.confidence")
    expect(component).toContain("finding.affectedPackage.fixedVersions")
    expect(component).toContain("finding.advisory.references")
  })
})
