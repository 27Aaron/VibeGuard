import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin security page scaffolding", () => {
  it("adds the security entry to admin navigation with bilingual copy and a real route shell", () => {
    const nav = fs.readFileSync("apps/web/components/admin/admin-nav.tsx", "utf8")
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8")
    const routePath = "apps/web/app/[lang]/admin/security/page.tsx"

    expect(nav).toContain('href: "/admin/security"')
    expect(copy).toContain('adminNavSecurity: "安全"')
    expect(copy).toContain('adminNavSecurity: "Security"')
    expect(fs.existsSync(routePath)).toBe(true)

    const route = fs.readFileSync(routePath, "utf8")

    expect(route).toContain("AdminPageShell")
    expect(route).toContain("copy.adminSecurityTitle")
    expect(route).toContain("copy.adminSecurityDescription")
    expect(route).toContain('currentNav="/admin/security"')
  })

  it("renders the dedicated security workbench instead of a placeholder panel", () => {
    const route = fs.readFileSync("apps/web/app/[lang]/admin/security/page.tsx", "utf8")
    const componentPath = "apps/web/components/admin/security-workbench.tsx"

    expect(fs.existsSync(componentPath)).toBe(true)

    const component = fs.readFileSync(componentPath, "utf8")

    expect(route).toContain("SecurityWorkbench")
    expect(route).toContain("<SecurityWorkbench lang={lang} />")
    expect(component).toContain('fetch("/api/security/check/packages"')
    expect(component).toContain("buildSecurityCheckRequestBody")
    expect(component).toContain("parseSecurityCheckPayload")
    expect(component).toContain("setResult(null)")
    expect(component).toContain("adminSecurityCheck")
    expect(component).toContain("adminSecurityChecking")
    expect(component).toContain("adminSecurityEmpty")
    expect(component).toContain("result?.warning")
    expect(component).toContain("adminSecurityNoFindings")
    expect(component).toContain("finding.matchSummary")
    expect(component).toContain("finding.matchReason")
    expect(component).toContain("finding.confidence")
    expect(component).toContain("finding.affectedPackage.fixedVersions")
    expect(component).toContain("finding.advisory.references")
    expect(component).not.toContain("adminSecurityTitle")
    expect(component).not.toContain("adminSecurityDescription")
  })
})
