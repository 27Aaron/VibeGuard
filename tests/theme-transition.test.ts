import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("theme transition helper", () => {
  it("creates a reusable view-transition based circular reveal helper", () => {
    const helper = fs.readFileSync("apps/web/lib/theme-transition.ts", "utf8")

    expect(helper).toContain("export function createThemeTransition")
    expect(helper).toContain("startViewTransition")
    expect(helper).toContain("theme-transition-active")
    expect(helper).toContain('"--theme-transition-x"')
    expect(helper).toContain('"--theme-transition-radius"')
    expect(helper).toContain("THEME_TRANSITION_DURATION_MS = 980")
    expect(helper).toContain("Math.hypot")
    expect(helper).toContain("prefers-reduced-motion")
    expect(helper).toContain("applyTheme")
  })
})
