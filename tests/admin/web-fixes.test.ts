import fs from "node:fs"

import { describe, expect, it } from "vitest"

// ---------------------------------------------------------------------------
// W35 – worker-status-panel polling interval increased to 5s
// ---------------------------------------------------------------------------
describe("W35: worker-status-panel polling interval", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/worker-status-panel.tsx",
    "utf8",
  )

  it("uses 5000ms interval instead of 1000ms", () => {
    expect(src).toContain("setInterval(fetchStatus, 5000)")
    expect(src).not.toContain("setInterval(fetchStatus, 1000)")
  })
})

// ---------------------------------------------------------------------------
// W36 – llm-settings-form loadProviderModels uses AbortController
// ---------------------------------------------------------------------------
describe("W36: loadProviderModels AbortController", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/llm-settings-form.tsx",
    "utf8",
  )

  it("creates an AbortController before fetching", () => {
    expect(src).toContain("AbortController")
    expect(src).toContain("abortControllerRef")
  })

  it("passes signal to fetch", () => {
    expect(src).toContain("signal: controller.signal")
  })

  it("cancels previous request on new call", () => {
    expect(src).toContain("abortControllerRef.current?.abort()")
  })

  it("handles AbortError silently", () => {
    expect(src).toContain("AbortError")
  })
})

// ---------------------------------------------------------------------------
// W60 – article-search-form syncs state with prop
// ---------------------------------------------------------------------------
describe("W60: article-search-form state sync", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/article-search-form.tsx",
    "utf8",
  )

  it("imports useEffect", () => {
    expect(src).toContain("useEffect")
  })

  it("syncs value state when defaultValue prop changes", () => {
    expect(src).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*setValue\(defaultValue\)/)
  })
})

// ---------------------------------------------------------------------------
// W61 – test connection button loading state
// ---------------------------------------------------------------------------
describe("W61: test connection button loading feedback", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/llm-settings-form.tsx",
    "utf8",
  )

  it("shows loading label when action is pending", () => {
    expect(src).toContain("测试中...")
    expect(src).toContain("Testing...")
  })

  it("conditionally renders based on isActionPending", () => {
    // The test button toggles between idle and pending labels
    expect(src).toContain("isActionPending")
    expect(src).toContain("测试中...")
    expect(src).toContain("测试连接")
  })
})

// ---------------------------------------------------------------------------
// W62 – osv-sync-panel auto-refresh after sync
// ---------------------------------------------------------------------------
describe("W62: osv-sync-panel auto-refresh after sync", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/osv-sync-panel.tsx",
    "utf8",
  )

  it("OsvSyncButton accepts onSyncComplete callback", () => {
    expect(src).toContain("onSyncComplete")
  })

  it("calls onSyncComplete after sync finishes", () => {
    expect(src).toContain("onSyncComplete?.()")
  })

  it("OsvSyncPanel passes fetchStatus as onSyncComplete", () => {
    expect(src).toContain("onSyncComplete={fetchStatus}")
  })
})

// ---------------------------------------------------------------------------
// W63 – feed-table useFormStatus loading state
// ---------------------------------------------------------------------------
describe("W63: feed-table useFormStatus loading state", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/feed-table.tsx",
    "utf8",
  )

  it('is a client component with "use client"', () => {
    expect(src.startsWith('"use client"')).toBe(true)
  })

  it("imports useFormStatus from react-dom", () => {
    expect(src).toContain("useFormStatus")
    expect(src).toContain('react-dom')
  })

  it("defines FeedActionButton with pending state", () => {
    expect(src).toContain("FeedActionButton")
    expect(src).toContain("useFormStatus()")
    expect(src).toContain("{ pending }")
  })

  it("uses FeedActionButton in inline forms", () => {
    expect(src).toContain("<FeedActionButton")
    expect(src).not.toMatch(/<Button[^>]*type="submit"/)
  })
})

// ---------------------------------------------------------------------------
// W64 – redirect-countdown interval changed to 1000ms
// ---------------------------------------------------------------------------
describe("W64: redirect-countdown interval", () => {
  const src = fs.readFileSync(
    "apps/web/components/redirect-countdown.tsx",
    "utf8",
  )

  it("uses 1000ms interval", () => {
    expect(src).toContain(", 1000)")
    expect(src).not.toContain(", 200)")
  })
})

// ---------------------------------------------------------------------------
// W65 – job-stage-filter-select runtime validation
// ---------------------------------------------------------------------------
describe("W65: job-stage-filter-select runtime validation", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/job-stage-filter-select.tsx",
    "utf8",
  )

  it("validates stage value against ADMIN_JOB_STAGE_FILTERS", () => {
    expect(src).toContain("ADMIN_JOB_STAGE_FILTERS.includes")
  })

  it("falls back to 'all' for invalid values", () => {
    expect(src).toContain('"all"')
  })

  it("does not use bare 'as JobStageFilter' cast", () => {
    expect(src).not.toMatch(/event\.target\.value as JobStageFilter\b[^)]/)
  })
})

// ---------------------------------------------------------------------------
// W66 – language-toggle document.startViewTransition typed
// ---------------------------------------------------------------------------
describe("W66: language-toggle startViewTransition typing", () => {
  const src = fs.readFileSync(
    "apps/web/components/language-toggle.tsx",
    "utf8",
  )

  it("uses the built-in startViewTransition type instead of redeclaring Document", () => {
    expect(src).toContain("startViewTransition")
    expect(src).not.toContain("declare global")
    expect(src).not.toContain("interface Document")
  })
})

// ---------------------------------------------------------------------------
// W67 – page-select scrolls to top on page change
// ---------------------------------------------------------------------------
describe("W67: page-select scrollTo on navigation", () => {
  const src = fs.readFileSync(
    "apps/web/components/page-select.tsx",
    "utf8",
  )

  it("calls window.scrollTo(0, 0) in navigateTo", () => {
    expect(src).toContain("window.scrollTo(0, 0)")
  })
})

// ---------------------------------------------------------------------------
// W68 – osv-sync-panel aria-live on error element
// ---------------------------------------------------------------------------
describe("W68: osv-sync-panel aria-live placement", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/osv-sync-panel.tsx",
    "utf8",
  )

  it("moves aria-live to the error message element", () => {
    // Error message should have aria-live
    expect(src).toMatch(/text-destructive[^>]*aria-live="polite"/)
  })

  it("removes aria-live from static text", () => {
    // The static helper text should not have aria-live
    const staticTextMatch = src.match(
      /text-muted-foreground[^>]*aria-live/,
    )
    expect(staticTextMatch).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// W69 – article-table warns for unknown statuses
// ---------------------------------------------------------------------------
describe("W69: article-table unknown status warning", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/article-table.tsx",
    "utf8",
  )

  it("logs a warning for unknown statuses in the default branch", () => {
    expect(src).toContain("console.warn")
    expect(src).toContain("Unknown article status")
  })

  it("still returns a fallback label", () => {
    expect(src).toContain("待处理")
    expect(src).toContain("Pending")
  })
})

// ---------------------------------------------------------------------------
// W70 – endpoint-card lang typed as AppLang
// ---------------------------------------------------------------------------
describe("W70: endpoint-card lang type", () => {
  const src = fs.readFileSync(
    "apps/web/app/[lang]/api/endpoint-card.tsx",
    "utf8",
  )

  it("imports AppLang type", () => {
    expect(src).toContain("import type { AppLang }")
  })

  it("uses AppLang instead of string for lang prop", () => {
    expect(src).toContain("lang: AppLang")
    expect(src).not.toMatch(/lang:\s*string/)
  })
})

// ---------------------------------------------------------------------------
// W71 – duplicate skill/copy-button removed
// ---------------------------------------------------------------------------
describe("W71: duplicate skill/copy-button removed", () => {
  it("the duplicate file no longer exists", () => {
    const exists = fs.existsSync(
      "apps/web/app/[lang]/skill/copy-button.tsx",
    )
    expect(exists).toBe(false)
  })

  it("the canonical copy-button still exists", () => {
    const exists = fs.existsSync(
      "apps/web/components/ui/copy-button.tsx",
    )
    expect(exists).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// W72 – job-select-all-checkbox uses React state
// ---------------------------------------------------------------------------
describe("W72: job-select-all-checkbox React state", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/job-select-all-checkbox.tsx",
    "utf8",
  )

  it("does not use document.querySelectorAll directly in the component body", () => {
    // The old code had a standalone function using querySelectorAll with form= attribute
    expect(src).not.toContain(
      'input[type="checkbox"][form="${formId}"]',
    )
  })

  it("manages checked and count state with React state", () => {
    expect(src).toContain("setChecked")
    expect(src).toContain("setCheckedCount")
  })
})

// ---------------------------------------------------------------------------
// W73 – admin/error.tsx default language "zh"
// ---------------------------------------------------------------------------
describe("W73: admin error.tsx default language", () => {
  const src = fs.readFileSync(
    "apps/web/app/[lang]/admin/error.tsx",
    "utf8",
  )

  it('defaults to "zh" not "en"', () => {
    expect(src).toContain('|| "zh"')
    expect(src).not.toContain('|| "en"')
  })
})

// ---------------------------------------------------------------------------
// W74 – markdown-renderer memoized components
// ---------------------------------------------------------------------------
describe("W74: markdown-renderer memoized components", () => {
  const src = fs.readFileSync(
    "apps/web/components/content/markdown-renderer.tsx",
    "utf8",
  )

  it("imports useMemo", () => {
    expect(src).toContain("useMemo")
  })

  it("wraps components prop in useMemo", () => {
    expect(src).toContain("components={useMemo(() => ({")
  })

  it("has dependency array for useMemo", () => {
    expect(src).toMatch(
      /\[palette,\s*lang,\s*sourceUrl,\s*copiedCodeBlock,\s*resolvedTheme,\s*text\.copiedCode,\s*text\.copyCode\]/,
    )
  })
})

// ---------------------------------------------------------------------------
// W75 – custom-select keyboard navigation
// ---------------------------------------------------------------------------
describe("W75: custom-select keyboard navigation", () => {
  const src = fs.readFileSync(
    "apps/web/components/ui/custom-select.tsx",
    "utf8",
  )

  it("tracks active/highlighted index with state", () => {
    expect(src).toContain("activeIndex")
    expect(src).toContain("setActiveIndex")
  })

  it("handles ArrowDown key", () => {
    expect(src).toContain("ArrowDown")
  })

  it("handles ArrowUp key", () => {
    expect(src).toContain("ArrowUp")
  })

  it("handles Enter key to select", () => {
    expect(src).toContain('"Enter"')
  })

  it("uses aria-activedescendant", () => {
    expect(src).toContain("aria-activedescendant")
  })

  it("assigns id to option elements for aria", () => {
    expect(src).toContain("select-option-")
  })
})

// ---------------------------------------------------------------------------
// W76 – llm-settings-form isActive checkbox label association
// ---------------------------------------------------------------------------
describe("W76: isActive checkbox label association", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/llm-settings-form.tsx",
    "utf8",
  )

  it("has a label with htmlFor pointing to the checkbox", () => {
    expect(src).toContain('htmlFor="is-active-checkbox"')
    expect(src).toContain('id="is-active-checkbox"')
  })
})

// ---------------------------------------------------------------------------
// W77 – feed-table delete button aria-label
// ---------------------------------------------------------------------------
describe("W77: feed-table delete button aria confirmation", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/feed-table.tsx",
    "utf8",
  )

  it("delete button has aria-label describing the action", () => {
    expect(src).toContain('aria-label={lang === "zh" ? `删除 ${feed.name}` : `Delete ${feed.name}`}')
  })
})

// ---------------------------------------------------------------------------
// W78 – custom-select focus trap (Tab closes dropdown)
// ---------------------------------------------------------------------------
describe("W78: custom-select focus trap", () => {
  const src = fs.readFileSync(
    "apps/web/components/ui/custom-select.tsx",
    "utf8",
  )

  it("handles Tab key to close dropdown", () => {
    expect(src).toContain('"Tab"')
    expect(src).toMatch(/"Tab"[\s\S]*?setOpen\(false\)/)
  })
})
