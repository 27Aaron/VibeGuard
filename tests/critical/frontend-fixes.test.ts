import fs from "node:fs"

import { describe, expect, it } from "vitest"

const FEED_TABLE = fs.readFileSync("apps/web/components/admin/feed-table.tsx", "utf8")
const LLM_SETTINGS = fs.readFileSync(
  "apps/web/components/admin/llm-settings-form.tsx",
  "utf8",
)
const COPY_BUTTON = fs.readFileSync("apps/web/components/ui/copy-button.tsx", "utf8")
const MARKDOWN_RENDERER = fs.readFileSync(
  "apps/web/components/content/markdown-renderer.tsx",
  "utf8",
)

describe("SEC-05: delete action confirmation", () => {
  it("delete form has an onSubmit handler with confirm()", () => {
    expect(FEED_TABLE).toContain("onSubmit")
    expect(FEED_TABLE).toContain("confirm(")
    expect(FEED_TABLE).toContain("preventDefault")
  })

  it("confirm dialog includes a warning message", () => {
    expect(FEED_TABLE).toContain("确认删除")
    expect(FEED_TABLE).toContain("cannot be undone")
  })

  it("delete form still binds deleteFeedAction", () => {
    expect(FEED_TABLE).toContain("action={deleteFeedAction}")
  })
})

describe("BUG-04: no duplicate isActive input", () => {
  it("has exactly one form element named isActive", () => {
    const isActiveInputs = LLM_SETTINGS.match(
      /name="isActive"/g,
    )
    expect(isActiveInputs).toHaveLength(1)
  })

  it("the remaining isActive element is a checkbox (not hidden)", () => {
    expect(LLM_SETTINGS).toContain('type="checkbox"')
    expect(LLM_SETTINGS).toContain('name="isActive"')
    expect(LLM_SETTINGS).not.toContain(
      '<input type="hidden" name="isActive"',
    )
  })
})

describe("BUG-05: selectedPresetIndex bounds guard", () => {
  it("checks both lower and upper bounds before indexing PROVIDER_PRESETS", () => {
    expect(LLM_SETTINGS).toContain("selectedPresetIndex >= 0")
    expect(LLM_SETTINGS).toContain("selectedPresetIndex < PROVIDER_PRESETS.length")
  })

  it("falls back to empty string for out-of-bounds index", () => {
    const valueLine = LLM_SETTINGS.match(
      /value=\{form\.selectedPresetIndex.*?\}/s,
    )
    expect(valueLine).toBeTruthy()
    expect(valueLine![0]).toContain('""')
  })
})

describe("UX-01: clipboard error handling", () => {
  it("CopyButton wraps writeText in try/catch", () => {
    expect(COPY_BUTTON).toContain("try {")
    expect(COPY_BUTTON).toContain("await navigator.clipboard.writeText")
    expect(COPY_BUTTON).toContain("} catch {")
    expect(COPY_BUTTON).toContain("return")
  })

  it("CopyButton sets copied state only after successful write", () => {
    const tryBlock = COPY_BUTTON.match(/try \{[\s\S]*?\} catch/)
    expect(tryBlock).toBeTruthy()
    expect(tryBlock![0]).toContain("clipboard.writeText")
    expect(tryBlock![0]).not.toContain("setCopied")
  })

  it("markdown-renderer code copy wraps writeText in try/catch", () => {
    expect(MARKDOWN_RENDERER).toContain("try {")
    expect(MARKDOWN_RENDERER).toContain("await navigator.clipboard.writeText(code)")
    expect(MARKDOWN_RENDERER).toContain("} catch {")
  })

  it("markdown-renderer sets copied state only after successful write", () => {
    const mdCopyMatch = MARKDOWN_RENDERER.match(
      /const handleCopy = async[\s\S]*?try \{[\s\S]*?\} catch/,
    )
    expect(mdCopyMatch).toBeTruthy()
    expect(mdCopyMatch![0]).not.toContain("setCopiedCodeBlock")
  })
})
