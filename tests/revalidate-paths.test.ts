import { describe, expect, it } from "vitest"

import { getLocalizedRevalidationPaths } from "../apps/web/lib/revalidate"

describe("localized revalidation paths", () => {
  it("expands public and admin paths to both supported locale routes", () => {
    expect(
      getLocalizedRevalidationPaths([
        "/",
        "/admin",
        "/admin/articles",
        "/admin/articles/article-1",
        "/articles/article-1",
      ]),
    ).toEqual([
      "/",
      "/zh",
      "/en",
      "/admin",
      "/zh/admin",
      "/en/admin",
      "/admin/articles",
      "/zh/admin/articles",
      "/en/admin/articles",
      "/admin/articles/article-1",
      "/zh/admin/articles/article-1",
      "/en/admin/articles/article-1",
      "/articles/article-1",
      "/zh/articles/article-1",
      "/en/articles/article-1",
    ])
  })

  it("keeps already localized and api paths unchanged", () => {
    expect(
      getLocalizedRevalidationPaths([
        "/zh/admin/jobs",
        "/en/feed.xml",
        "/api/articles",
      ]),
    ).toEqual(["/zh/admin/jobs", "/en/feed.xml", "/api/articles"])
  })
})
