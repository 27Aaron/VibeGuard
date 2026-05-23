import { describe, expect, it } from "vitest"

import { classifySecurityContent } from "../../packages/content/src/classify"

describe("security content classification", () => {
  it("detects a malicious npm package article", () => {
    const result = classifySecurityContent({
      sourceName: "SafeDep",
      title: "Malicious npm package shipped a backdoor to developers",
      summary: "The typosquat package installed malware during postinstall.",
      categories: ["npm", "malware"],
    })

    expect(result.ecosystem).toBe("npm")
    expect(result.riskCategory).toBe("malicious-package")
    expect(result.tags).toEqual(
      expect.arrayContaining(["npm", "malicious-package", "malware", "typosquat"]),
    )
  })

  it("detects exploit activity around a CVE", () => {
    const result = classifySecurityContent({
      sourceName: "StepSecurity",
      title: "CVE-2026-12345 is now actively exploited in the wild",
      content: "Known exploited vulnerability affecting GitHub Actions workflows.",
    })

    expect(result.riskCategory).toBe("exploit-activity")
    expect(result.tags).toEqual(
      expect.arrayContaining(["exploit-activity", "cve", "exploit"]),
    )
  })

  it("marks multiple ecosystems when the text spans more than one package ecosystem", () => {
    const result = classifySecurityContent({
      title: "Cross-ecosystem supply-chain campaign targeted npm and PyPI",
      content: "The malware hit both npm and Python package indexes.",
    })

    expect(result.ecosystem).toBe("multi")
    expect(result.riskCategory).toBe("malicious-package")
  })
})
