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

  it("runs database migrations before starting web and worker without managing Postgres", () => {
    const script = fs.readFileSync("scripts/dev-stack.mjs", "utf8")

    expect(script).toContain("bootstrapDatabase")
    expect(script).toContain('"db:migrate"')
    expect(script).not.toContain("dockerCommand")
    expect(script).not.toMatch(/"compose",\s*"up"/)
    expect(script).not.toContain("waitForPort")
    expect(script.indexOf("await bootstrapDatabase()")).toBeLessThan(
      script.indexOf("const children = processes.map"),
    )
  })
})
