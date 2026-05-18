import { describe, expect, it } from "vitest"

import { buildPublicTagFilterModel } from "../apps/web/lib/public-tag-filters"

describe("public tag filters", () => {
  it("shows the most common tags first", () => {
    const model = buildPublicTagFilterModel(
      [
        { tag: "pypi", count: 3 },
        { tag: "npm", count: 9 },
        { tag: "actions", count: 5 },
      ],
      "",
      2,
    )

    expect(model.visibleTags.map((item) => item.tag)).toEqual(["npm", "actions"])
    expect(model.overflowTags.map((item) => item.tag)).toEqual(["pypi"])
  })

  it("keeps the selected tag visible even when it is outside the popular set", () => {
    const model = buildPublicTagFilterModel(
      [
        { tag: "npm", count: 9 },
        { tag: "actions", count: 5 },
        { tag: "sigstore", count: 1 },
      ],
      "sigstore",
      2,
    )

    expect(model.visibleTags).toEqual([
      { tag: "npm", count: 9, active: false },
      { tag: "actions", count: 5, active: false },
      { tag: "sigstore", count: 1, active: true },
    ])
    expect(model.overflowTags).toEqual([])
  })

  it("can represent a selected tag that is not in the current counts", () => {
    const model = buildPublicTagFilterModel([{ tag: "npm", count: 9 }], "ghost-tag")

    expect(model.visibleTags).toContainEqual({
      tag: "ghost-tag",
      count: 0,
      active: true,
    })
    expect(model.hasTags).toBe(true)
  })
})
