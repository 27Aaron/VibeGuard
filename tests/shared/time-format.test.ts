import { describe, expect, it } from "vitest"

import { formatDateTimeInShanghai } from "../../apps/web/lib/time"

describe("Shanghai time formatting", () => {
  it("uses localized fallback text when a date is missing", () => {
    expect(formatDateTimeInShanghai(null)).toBe("待处理")
    expect(formatDateTimeInShanghai(null, { lang: "en" })).toBe("Pending")
    expect(formatDateTimeInShanghai(null, { fallback: "Not started" })).toBe(
      "Not started",
    )
  })
})
