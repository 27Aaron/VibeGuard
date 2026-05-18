import { describe, expect, it } from "vitest"

import { buildArticleListMeta, parseArticleListParams } from "../apps/web/lib/api-articles"

describe("article api query parsing", () => {
  it("defaults to ready chinese results with a sane limit", () => {
    const params = parseArticleListParams(new URLSearchParams())

    expect(params).toEqual({
      lang: "zh",
      status: "ready",
      source: "",
      query: "",
      ecosystem: "",
      riskCategory: "",
      tag: "",
      limit: 20,
      page: 1,
    })
  })

  it("accepts known filters and clamps the limit", () => {
    const params = parseArticleListParams(
      new URLSearchParams({
        lang: "zh",
        status: "failed",
        source: "SafeDep",
        q: "malware",
        ecosystem: "npm",
        riskCategory: "malicious-package",
        tag: "typosquat",
        limit: "500",
        page: "0",
      }),
    )

    expect(params).toEqual({
      lang: "zh",
      status: "failed",
      source: "SafeDep",
      query: "malware",
      ecosystem: "npm",
      riskCategory: "malicious-package",
      tag: "typosquat",
      limit: 100,
      page: 1,
    })
  })

  it("falls back to ready when an unknown status is supplied", () => {
    const params = parseArticleListParams(
      new URLSearchParams({
        status: "broken",
      }),
    )

    expect(params.status).toBe("ready")
  })

  it("clamps invalid pages and keeps positive page values", () => {
    const invalid = parseArticleListParams(
      new URLSearchParams({
        page: "-7",
      }),
    )
    const valid = parseArticleListParams(
      new URLSearchParams({
        page: "3",
        limit: "12",
      }),
    )

    expect(invalid.page).toBe(1)
    expect(valid.page).toBe(3)
    expect(valid.limit).toBe(12)
  })
})

describe("article api pagination metadata", () => {
  it("builds metadata with total pages for paginated responses", () => {
    expect(
      buildArticleListMeta({
        lang: "en",
        status: "ready",
        source: "",
        query: "",
        ecosystem: "",
        riskCategory: "",
        tag: "",
        limit: 24,
        page: 3,
        totalCount: 55,
        count: 7,
      }),
    ).toEqual({
      lang: "en",
      status: "ready",
      source: null,
      query: null,
      ecosystem: null,
      riskCategory: null,
      tag: null,
      limit: 24,
      count: 7,
      page: 3,
      pageSize: 24,
      totalCount: 55,
      totalPages: 3,
    })
  })

  it("clamps metadata to a real page when the requested page is out of range", () => {
    expect(
      buildArticleListMeta({
        lang: "zh",
        status: "ready",
        source: "SafeDep",
        query: "openssl",
        ecosystem: "npm",
        riskCategory: "vulnerability",
        tag: "cve",
        limit: 10,
        page: 5,
        totalCount: 0,
        count: 0,
      }),
    ).toMatchObject({
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,
      source: "SafeDep",
      query: "openssl",
      ecosystem: "npm",
      riskCategory: "vulnerability",
      tag: "cve",
    })

    expect(
      buildArticleListMeta({
        lang: "en",
        status: "ready",
        source: "",
        query: "",
        ecosystem: "",
        riskCategory: "",
        tag: "",
        limit: 20,
        page: 9,
        totalCount: 41,
        count: 0,
      }),
    ).toMatchObject({
      page: 3,
      totalPages: 3,
    })
  })
})
