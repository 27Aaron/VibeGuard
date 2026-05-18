import { describe, expect, it } from "vitest"

import { buildSummaryPreviewText } from "../apps/web/lib/summary-preview"

describe("public summary preview", () => {
  it("produces a clamp-friendly single-flow preview string", () => {
    const summary = [
      "**安全简报：xinference PyPI供应链攻击事件**",
      "",
      "1. **针对性攻击：** 攻击短时间内快速迭代版本。",
      "2. **严重危害：** 窃取云凭证与 SSH 密钥。",
      "",
      "`xinference` 用户需立即排查。",
    ].join("\n")

    expect(buildSummaryPreviewText(summary)).toBe(
      "安全简报：xinference PyPI供应链攻击事件 针对性攻击： 攻击短时间内快速迭代版本。 严重危害： 窃取云凭证与 SSH 密钥。 xinference 用户需立即排查。",
    )
  })
})
