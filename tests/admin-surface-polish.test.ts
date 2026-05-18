import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("admin surface polish", () => {
  it("gives the feed table a proper empty state instead of an empty shell", () => {
    const file = fs.readFileSync("apps/web/components/admin/feed-table.tsx", "utf8")

    expect(file).toContain("emptyStateTitle")
    expect(file).toContain("当前还没有配置任何来源")
  })

  it("treats saved settings profiles like a configuration center with summary copy", () => {
    const file = fs.readFileSync("apps/web/components/admin/settings-profile-list.tsx", "utf8")

    expect(file).toContain("savedCountLabel")
    expect(file).toContain("当前生效模型")
    expect(file).toContain("新建配置")
    expect(file).toContain("配置列表")
    expect(file).toContain("h-fit")
  })

  it("groups feed actions into a compact operation cluster with icon affordances", () => {
    const file = fs.readFileSync("apps/web/components/admin/feed-table.tsx", "utf8")

    expect(file).toContain("rounded-[1rem] border border-black/5 bg-white/68")
    expect(file).toContain("RefreshCw")
    expect(file).toContain("PauseCircle")
    expect(file).toContain("Trash2")
  })

  it("lets the settings form title follow the saved profile name instead of a hard-coded provider label", () => {
    const file = fs.readFileSync("apps/web/components/admin/llm-settings-form.tsx", "utf8")

    expect(file).toContain("providerCardTitle")
    expect(file).toContain("provider.settingsName.trim() || provider.providerName")
  })
})
