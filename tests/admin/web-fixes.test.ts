import fs from "node:fs";

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// worker-status-panel 轮询间隔改为 5 秒
// ---------------------------------------------------------------------------
describe("worker-status-panel 轮询间隔改为 5 秒", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/worker-status-panel.tsx",
    "utf8",
  );

  it("uses 5000ms interval instead of 1000ms", () => {
    expect(src).toContain("setInterval(fetchStatus, 5000)");
    expect(src).not.toContain("setInterval(fetchStatus, 1000)");
  });
});

// ---------------------------------------------------------------------------
// llm-settings-form loadProviderModels 使用 AbortController
// ---------------------------------------------------------------------------
describe("loadProviderModels 使用 AbortController", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/llm-settings-form.tsx",
    "utf8",
  );

  it("creates an AbortController before fetching", () => {
    expect(src).toContain("AbortController");
    expect(src).toContain("abortControllerRef");
  });

  it("passes signal to fetch", () => {
    expect(src).toContain("signal: controller.signal");
  });

  it("cancels previous request on new call", () => {
    expect(src).toContain("abortControllerRef.current?.abort()");
  });

  it("handles AbortError silently", () => {
    expect(src).toContain("AbortError");
  });
});

// ---------------------------------------------------------------------------
// article-search-form 状态与 prop 同步
// ---------------------------------------------------------------------------
describe("article-search-form 状态与 prop 同步", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/article-search-form.tsx",
    "utf8",
  );

  it("imports useEffect", () => {
    expect(src).toContain("useEffect");
  });

  it("syncs value state when defaultValue prop changes", () => {
    expect(src).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*setValue\(defaultValue\)/);
  });
});

// ---------------------------------------------------------------------------
// 测试连接按钮加载状态
// ---------------------------------------------------------------------------
describe("测试连接按钮加载状态", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/llm-settings-form.tsx",
    "utf8",
  );

  it("shows loading label when action is pending", () => {
    expect(src).toContain("测试中...");
    expect(src).toContain("Testing...");
  });

  it("conditionally renders based on isActionPending", () => {
    // The test button toggles between idle and pending labels
    expect(src).toContain("isActionPending");
    expect(src).toContain("测试中...");
    expect(src).toContain("测试连接");
  });
});

// ---------------------------------------------------------------------------
// osv-sync-panel 同步完成后自动刷新
// ---------------------------------------------------------------------------
describe("osv-sync-panel 同步完成后自动刷新", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/osv-sync-panel.tsx",
    "utf8",
  );

  it("SecuritySyncButton accepts onSyncComplete callback", () => {
    expect(src).toContain("onSyncComplete");
  });

  it("calls onSyncComplete with sync result after sync finishes", () => {
    expect(src).toContain("onSyncComplete?.(data)");
  });

  it("SecuritySyncPanel passes handleSyncComplete as onSyncComplete", () => {
    expect(src).toContain("onSyncComplete={handleSyncComplete}");
  });
});

// ---------------------------------------------------------------------------
// feed-table useFormStatus 加载状态
// ---------------------------------------------------------------------------
describe("feed-table useFormStatus 加载状态", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/feed-table.tsx",
    "utf8",
  );

  it('is a client component with "use client"', () => {
    expect(src.startsWith('"use client"')).toBe(true);
  });

  it("imports useFormStatus from react-dom", () => {
    expect(src).toContain("useFormStatus");
    expect(src).toContain("react-dom");
  });

  it("defines FeedActionButton with pending state", () => {
    expect(src).toContain("FeedActionButton");
    expect(src).toContain("useFormStatus()");
    expect(src).toContain("{ pending }");
  });

  it("uses FeedActionButton in inline forms", () => {
    expect(src).toContain("<FeedActionButton");
    expect(src.match(/<FeedActionButton/g)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// redirect-countdown 倒计时间隔改为 1000ms
// ---------------------------------------------------------------------------
describe("redirect-countdown 倒计时间隔改为 1000ms", () => {
  const src = fs.readFileSync(
    "apps/web/components/redirect-countdown.tsx",
    "utf8",
  );

  it("uses 1000ms interval", () => {
    expect(src).toContain(", 1000)");
    expect(src).not.toContain(", 200)");
  });
});

// ---------------------------------------------------------------------------
// job-stage-filter-select 运行时校验
// ---------------------------------------------------------------------------
describe("job-stage-filter-select 运行时校验", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/job-stage-filter-select.tsx",
    "utf8",
  );

  it("validates stage value against ADMIN_JOB_STAGE_FILTERS", () => {
    expect(src).toContain("ADMIN_JOB_STAGE_FILTERS.includes");
  });

  it("falls back to 'all' for invalid values", () => {
    expect(src).toContain('"all"');
  });

  it("does not use bare 'as JobStageFilter' cast", () => {
    expect(src).not.toMatch(/event\.target\.value as JobStageFilter\b[^)]/);
  });
});

// ---------------------------------------------------------------------------
// language-toggle startViewTransition 类型声明
// ---------------------------------------------------------------------------
describe("language-toggle startViewTransition 类型声明", () => {
  const src = fs.readFileSync(
    "apps/web/components/language-toggle.tsx",
    "utf8",
  );

  it("uses the built-in startViewTransition type instead of redeclaring Document", () => {
    expect(src).toContain("startViewTransition");
    expect(src).not.toContain("declare global");
    expect(src).not.toContain("interface Document");
  });
});

// ---------------------------------------------------------------------------
// page-select 翻页时滚动到顶部
// ---------------------------------------------------------------------------
describe("page-select 翻页时滚动到顶部", () => {
  const src = fs.readFileSync("apps/web/components/page-select.tsx", "utf8");

  it("calls window.scrollTo(0, 0) in navigateTo", () => {
    expect(src).toContain("window.scrollTo(0, 0)");
  });
});

// ---------------------------------------------------------------------------
// osv-sync-panel 错误元素添加 aria-live
// ---------------------------------------------------------------------------
describe("osv-sync-panel 错误元素添加 aria-live", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/osv-sync-panel.tsx",
    "utf8",
  );

  it("moves aria-live to the error message element", () => {
    // Error message should have aria-live
    expect(src).toMatch(/text-destructive[^>]*aria-live="polite"/);
  });

  it("removes aria-live from static text", () => {
    // The static helper text should not have aria-live
    const staticTextMatch = src.match(/text-muted-foreground[^>]*aria-live/);
    expect(staticTextMatch).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// article-table 未知状态警告
// ---------------------------------------------------------------------------
describe("article-table 未知状态警告", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/article-table.tsx",
    "utf8",
  );

  it("logs a warning for unknown statuses in the default branch", () => {
    expect(src).toContain("console.warn");
    expect(src).toContain("Unknown article status");
  });

  it("still returns a fallback label", () => {
    expect(src).toContain("待处理");
    expect(src).toContain("Pending");
  });
});

// ---------------------------------------------------------------------------
// endpoint-card lang 类型改为 AppLang
// ---------------------------------------------------------------------------
describe("endpoint-card lang 类型改为 AppLang", () => {
  const src = fs.readFileSync(
    "apps/web/app/[lang]/api/endpoint-card.tsx",
    "utf8",
  );

  it("imports AppLang type", () => {
    expect(src).toContain("import type { AppLang }");
  });

  it("uses AppLang instead of string for lang prop", () => {
    expect(src).toContain("lang: AppLang");
    expect(src).not.toMatch(/lang:\s*string/);
  });
});

// ---------------------------------------------------------------------------
// 移除重复的 skill/copy-button
// ---------------------------------------------------------------------------
describe("移除重复的 skill/copy-button", () => {
  it("the duplicate file no longer exists", () => {
    const exists = fs.existsSync("apps/web/app/[lang]/skill/copy-button.tsx");
    expect(exists).toBe(false);
  });

  it("the canonical copy-button still exists", () => {
    const exists = fs.existsSync("apps/web/components/ui/copy-button.tsx");
    expect(exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// job-select-all-checkbox 使用 React state
// ---------------------------------------------------------------------------
describe("job-select-all-checkbox 使用 React state", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/job-select-all-checkbox.tsx",
    "utf8",
  );
  const sharedSrc = fs.readFileSync(
    "apps/web/components/admin/admin-select-all-checkbox.tsx",
    "utf8",
  );

  it("does not use document.querySelectorAll directly in the component body", () => {
    // The old code had a standalone function using querySelectorAll with form= attribute
    expect(sharedSrc).not.toContain('input[type="checkbox"][form="${formId}"]');
  });

  it("delegates to the shared checkbox state component", () => {
    expect(src).toContain("AdminSelectAllCheckbox");
    expect(sharedSrc).toContain("setChecked");
    expect(sharedSrc).toContain("setDisabled");
    expect(sharedSrc).toContain("form.elements");
  });
});

// ---------------------------------------------------------------------------
// admin/error.tsx 默认语言改为 zh
// ---------------------------------------------------------------------------
describe("admin/error.tsx 默认语言改为 zh", () => {
  const src = fs.readFileSync("apps/web/app/[lang]/admin/error.tsx", "utf8");

  it('defaults to "zh" not "en"', () => {
    expect(src).toContain('|| "zh"');
    expect(src).not.toContain('|| "en"');
  });
});

// ---------------------------------------------------------------------------
// markdown-renderer 组件 memo 化
// ---------------------------------------------------------------------------
describe("markdown-renderer 组件 memo 化", () => {
  const src = fs.readFileSync(
    "apps/web/components/content/markdown-renderer.tsx",
    "utf8",
  );

  it("imports useMemo", () => {
    expect(src).toContain("useMemo");
  });

  it("wraps components prop in useMemo", () => {
    expect(src).toMatch(/components=\{useMemo\(\s*\(\) => \(\{/);
  });

  it("has dependency array for useMemo", () => {
    expect(src).toMatch(
      /\[\s*palette,\s*lang,\s*sourceUrl,\s*copiedCodeBlock,\s*resolvedTheme,\s*text\.copiedCode,\s*text\.copyCode,\s*\]/,
    );
  });
});

// ---------------------------------------------------------------------------
// custom-select 键盘导航
// ---------------------------------------------------------------------------
describe("custom-select 键盘导航", () => {
  const src = fs.readFileSync(
    "apps/web/components/ui/custom-select.tsx",
    "utf8",
  );

  it("tracks active/highlighted index with state", () => {
    expect(src).toContain("activeIndex");
    expect(src).toContain("setActiveIndex");
  });

  it("handles ArrowDown key", () => {
    expect(src).toContain("ArrowDown");
  });

  it("handles ArrowUp key", () => {
    expect(src).toContain("ArrowUp");
  });

  it("handles Enter key to select", () => {
    expect(src).toContain('"Enter"');
  });

  it("uses aria-activedescendant", () => {
    expect(src).toContain("aria-activedescendant");
  });

  it("assigns id to option elements for aria", () => {
    expect(src).toContain("select-option-");
  });
});

// ---------------------------------------------------------------------------
// llm-settings-form isActive 复选框 label 关联
// ---------------------------------------------------------------------------
describe("isActive 复选框 label 关联", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/llm-settings-form.tsx",
    "utf8",
  );

  it("has a label with htmlFor pointing to the checkbox", () => {
    expect(src).toContain('htmlFor="is-active-checkbox"');
    expect(src).toContain('id="is-active-checkbox"');
  });
});

// ---------------------------------------------------------------------------
// feed-table 删除按钮添加 aria-label
// ---------------------------------------------------------------------------
describe("feed-table 删除按钮 aria-label", () => {
  const src = fs.readFileSync(
    "apps/web/components/admin/feed-table.tsx",
    "utf8",
  );

  it("delete button has aria-label describing the action", () => {
    expect(src).toMatch(
      /aria-label=\{\s*lang === "zh"\s*\?\s*`删除 \$\{feed\.name\}`\s*:\s*`Delete \$\{feed\.name\}`\s*\}/,
    );
  });
});

// ---------------------------------------------------------------------------
// custom-select 焦点陷阱（Tab 关闭下拉菜单）
// ---------------------------------------------------------------------------
describe("custom-select 焦点陷阱（Tab 关闭下拉菜单）", () => {
  const src = fs.readFileSync(
    "apps/web/components/ui/custom-select.tsx",
    "utf8",
  );

  it("handles Tab key to close dropdown", () => {
    expect(src).toContain('"Tab"');
    expect(src).toMatch(/"Tab"[\s\S]*?setOpen\(false\)/);
  });
});
