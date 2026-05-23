import { describe, expect, it } from "vitest"

import { evaluateAffectedPackageVersion } from "../../packages/content/src/osv/version-match"

describe("evaluateAffectedPackageVersion", () => {
  it("returns a high-confidence hit for explicit affected versions", () => {
    expect(
      evaluateAffectedPackageVersion({
        ecosystem: "npm",
        version: "1.0.1",
        affectedVersions: ["1.0.0", "1.0.1"],
        ranges: [],
      }),
    ).toMatchObject({
      affected: true,
      confidence: "high",
      matchReason: "explicit_affected_version",
    })
  })

  it("matches an introduced-fixed ecosystem range", () => {
    expect(
      evaluateAffectedPackageVersion({
        ecosystem: "npm",
        version: "1.5.0",
        affectedVersions: [],
        ranges: [
          {
            type: "ECOSYSTEM",
            events: [{ introduced: "1.0.0" }, { fixed: "2.0.0" }],
          },
        ],
      }),
    ).toMatchObject({
      affected: true,
      confidence: "high",
      matchReason: "version_in_ecosystem_range",
    })
  })

  it("matches a semver range used by npm advisories", () => {
    expect(
      evaluateAffectedPackageVersion({
        ecosystem: "npm",
        version: "1.6.0",
        affectedVersions: [],
        ranges: [
          {
            type: "SEMVER",
            events: [{ introduced: "1.0.0" }, { fixed: "1.15.0" }],
          },
        ],
      }),
    ).toMatchObject({
      affected: true,
      confidence: "high",
      matchReason: "version_in_ecosystem_range",
    })
  })

  it("returns a high-confidence miss when a version is outside all supported ranges", () => {
    expect(
      evaluateAffectedPackageVersion({
        ecosystem: "npm",
        version: "2.0.0",
        affectedVersions: [],
        ranges: [
          {
            type: "ECOSYSTEM",
            events: [{ introduced: "1.0.0" }, { fixed: "2.0.0" }],
          },
        ],
      }),
    ).toMatchObject({
      affected: false,
      confidence: "undetermined",
      matchReason: "version_outside_ecosystem_range",
    })
  })

  it("returns an inconclusive result for unsupported or unparseable versions", () => {
    expect(
      evaluateAffectedPackageVersion({
        ecosystem: "pypi",
        version: "weird-version",
        affectedVersions: [],
        ranges: [
          {
            type: "ECOSYSTEM",
            events: [{ introduced: "1.0" }, { fixed: "2.0" }],
          },
        ],
      }),
    ).toMatchObject({
      affected: false,
      confidence: "medium",
      matchReason: "range_present_but_inconclusive",
    })
  })
})
