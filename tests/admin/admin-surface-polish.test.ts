import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin surface polish", () => {
  it("gives the feed table a proper empty state instead of an empty shell", () => {
    const file = fs.readFileSync("apps/web/components/admin/feed-table.tsx", "utf8")

    expect(file).toContain("emptyStateTitle")
    expect(file).toContain("当前还没有配置任何来源")
  })

  it("uses a profile dropdown selector in the settings form", () => {
    const file = fs.readFileSync("apps/web/components/admin/llm-settings-form.tsx", "utf8")

    expect(file).toContain("profiles.map")
    expect(file).toContain("当前生效")
    expect(file).toContain("新建配置")
  })

  it("groups feed actions into a compact operation cluster with icon affordances", () => {
    const file = fs.readFileSync("apps/web/components/admin/feed-table.tsx", "utf8")

    expect(file).toContain("rounded-[1rem] border border-black/5 bg-white/68")
    expect(file).toContain("RefreshCw")
    expect(file).toContain("PauseCircle")
    expect(file).toContain("Trash2")
  })

  it("uses model config and pipeline section titles in the settings form", () => {
    const file = fs.readFileSync("apps/web/components/admin/llm-settings-form.tsx", "utf8")

    expect(file).toContain("模型配置")
    expect(file).toContain("处理链路")
    expect(file).toContain("selectedProfileId")
  })
})
