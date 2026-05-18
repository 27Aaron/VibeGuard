import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("dev stack port guard", () => {
  it("fails fast when the expected web port is already occupied", () => {
    const script = fs.readFileSync("scripts/dev-stack.mjs", "utf8")

    expect(script).toContain("isPortInUse")
    expect(script).toContain("已被占用")
    expect(script).toContain("旧的 3000 页面")
    expect(script).toContain('PORT: String(webPort)')
  })
})
