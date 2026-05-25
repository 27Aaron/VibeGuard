import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("admin home layout", () => {
  it("uses the shared admin page shell instead of a one-off header", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/page.tsx", "utf8");

    expect(page).toContain("AdminPageShell");
    expect(page).toContain('title: "总览"');
    expect(page).toContain('title: "Overview"');
    expect(page).not.toContain('title: "内容底座后台"');
    expect(page).not.toContain('title: "VibeGuard Admin"');
    expect(page).not.toContain("badge:");
  });

  it("uses descriptive management entry cards instead of raw route strings", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/page.tsx", "utf8");

    expect(page).toContain("维护 RSS/Atom 来源，调整同步节奏。");
    expect(page).toContain("检查入库内容，重生成标题、正文和摘要。");
    expect(page).toContain("追踪处理步骤，定位失败并重试。");
    expect(page).toContain("配置模型服务，维护翻译和摘要提示词。");
    expect(page).not.toContain("/admin/feeds");
    expect(page).not.toContain("/admin/articles");
    expect(page).not.toContain("/admin/jobs");
    expect(page).not.toContain("/admin/settings");
  });

  it("formats the worker trigger and job status as productized cards", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/page.tsx", "utf8");
    const i18n = fs.readFileSync("apps/web/lib/i18n.ts", "utf8");

    expect(page).toContain("operationsTitle");
    expect(page).toContain("queueTitle");
    expect(page).toContain("WorkerStatusPanel");
    expect(i18n).toContain('adminRunWorker: "抓取来源"');
    expect(i18n).toContain('adminRunWorker: "Fetch sources"');
    expect(i18n).not.toContain('adminRunWorker: "手动执行一轮"');
    expect(i18n).not.toContain('adminRunWorker: "Run worker once"');
  });

  it("keeps the common action entry cards in a 4-column grid", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/page.tsx", "utf8");

    expect(page).toContain("grid grid-cols-4 gap-2");
    expect(page).toContain("items-center justify-between");
    expect(page).toContain("hover:border-emerald-900/15");
    expect(page).not.toContain("group min-h-[104px]");
  });

  it("keeps overview metric cards compact with more comfortable horizontal padding", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/admin/page.tsx", "utf8");

    expect(page).toContain("min-h-26");
    expect(page).toContain("justify-center py-4");
    expect(page).toContain(
      'CardContent className="grid min-h-20 content-center gap-2.5 px-5"',
    );
    expect(page).toContain('CardDescription className="leading-none"');
    expect(page).not.toContain('className="min-h-[128px]"');
    expect(page).not.toContain('size="sm" className="min-h-[104px]"');
    expect(page).not.toContain('CardHeader className="px-5"');
  });

  it("uses a single-column layout for the settings form", () => {
    const page = fs.readFileSync(
      "apps/web/app/[lang]/admin/settings/page.tsx",
      "utf8",
    );

    expect(page).not.toContain("grid items-start gap-6");
    expect(page).toContain("LlmSettingsForm");
    expect(page).toContain("profiles={profiles}");
  });
});
