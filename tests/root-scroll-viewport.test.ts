import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("root scroll viewport", () => {
  it("paints the root viewport so bounce scrolling does not expose the browser fallback color", () => {
    const globals = fs.readFileSync("apps/web/app/globals.css", "utf8")

    expect(globals).toContain("html {")
    expect(globals).toContain("min-height: 100%;")
    expect(globals).toContain("body {")
    expect(globals).toContain("min-height: 100svh;")
    expect(globals).toContain("background-color: var(--background);")
    expect(globals).toContain("overscroll-behavior-y: none;")
  })
})
