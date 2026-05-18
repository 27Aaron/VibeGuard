import { describe, expect, it } from "vitest"

import { buildSummaryPreviewText } from "../apps/web/lib/summary-preview"

describe("summary preview text", () => {
  it("strips leading summary labels from preview text", () => {
    expect(buildSummaryPreviewText("Summary: A concise explanation.")).toBe(
      "A concise explanation.",
    )
    expect(buildSummaryPreviewText("摘要：这是摘要内容。")).toBe(
      "这是摘要内容。",
    )
    expect(
      buildSummaryPreviewText(
        "Key Security Development: An attacker compromised the package.",
      ),
    ).toBe("An attacker compromised the package.")
  })
})
