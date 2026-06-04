import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("public homepage card layout", () => {
  it("keeps the shared header focused on brand and controls without product-surface entry points", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");
    const publicHeader = fs.readFileSync(
      "apps/web/components/public-header.tsx",
      "utf8",
    );

    expect(page).toContain("<PublicHeader");
    expect(publicHeader).not.toContain("futureSurfaceLinks");
    expect(publicHeader).toContain("Live feed");
    expect(publicHeader).toContain("sticky top-2 z-40 sm:top-3");
    expect(publicHeader).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(publicHeader).toContain("items-center gap-2");
    expect(publicHeader).toContain("flex size-7 shrink-0");
    expect(publicHeader).toContain("sm:size-8");
    expect(publicHeader).toContain("bg-[#e9f2ec] text-emerald-950");
    expect(publicHeader).toContain(
      "text-[0.82rem] font-semibold leading-none tracking-normal sm:text-sm",
    );
    expect(publicHeader).toContain(
      "text-[0.5rem] font-medium uppercase leading-none tracking-[0.12em] sm:text-[0.58rem]",
    );
    expect(publicHeader).not.toContain('{ label: "API"');
    expect(publicHeader).not.toContain('{ label: "MCP"');
    expect(publicHeader).not.toContain('{ label: "RSS"');
    expect(publicHeader).not.toContain('{ label: "Skill"');
    expect(publicHeader).not.toContain('{ label: "Check"');
    expect(publicHeader).not.toContain('route: "/api"');
    expect(publicHeader).not.toContain('route: "/mcp"');
    expect(publicHeader).not.toContain('route: "/rss"');
    expect(publicHeader).not.toContain('route: "/skill"');
    expect(publicHeader).not.toContain('route: "/check"');
    expect(publicHeader).toContain("backdrop-blur-2xl");
    expect(publicHeader).toContain(
      "flex items-center justify-end gap-1 justify-self-end sm:gap-1.5",
    );
    expect(publicHeader).not.toContain("md:justify-self-center");
    expect(publicHeader).not.toContain("currentSurface");
    expect(publicHeader).not.toContain("item.route");
    expect(publicHeader).not.toContain("publicCheckNav");
    expect(publicHeader).not.toContain(
      "flex h-[26px] w-[26px] items-center justify-center",
    );
    expect(publicHeader).not.toContain("sm:inline dark:text-emerald-700");
    expect(publicHeader).not.toContain("sm:inline dark:text-zinc-500");
  });

  it("keeps the first screen focused on search and the article stream", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");
    const layoutTokens = fs.readFileSync(
      "apps/web/lib/layout-tokens.ts",
      "utf8",
    );
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8");

    expect(page).toContain('type="search"');
    expect(page).toContain("PublicTagFilter");
    expect(page).toContain("feed.meta.totalCount");
    expect(page).toContain("tagCounts.length");
    expect(page).toContain("text.publicEyebrowLive");
    expect(copy).toContain('publicEyebrowLive: "风险信号"');
    expect(copy).toContain('publicEyebrowLive: "Risk signals"');
    expect(page).toContain("dark:bg-emerald-300/10 dark:text-emerald-100");
    expect(page).not.toContain("bg-zinc-950 text-stone-50");
    expect(page).not.toContain("dark:bg-stone-100 dark:text-zinc-950");
    expect(page).toContain(
      "inline-flex h-6 items-center gap-1.5 rounded-full",
    );
    expect(page).toContain("sm:h-7 sm:gap-2 sm:px-3");
    expect(page).toContain(
      "text-[0.72rem] font-medium tracking-normal",
    );
    expect(page).not.toContain("publicEyebrowBilingual");
    expect(page).not.toContain("heroStatusCards");
    expect(page).not.toContain("Signal console");
    expect(page).not.toContain("Vibe Coding Guardrail");
    expect(page).not.toContain("把安全新闻翻译成：我的项目有没有中招");
    expect(page).not.toContain("publicEyebrowReadable");
    expect(page).not.toContain("篇可读文章");
    expect(page).not.toContain("readable articles`");
    expect(layoutTokens).toContain(
      "gap-5 px-3 pb-6 pt-3 sm:gap-6 sm:px-6 sm:pb-8 sm:pt-4",
    );
    expect(layoutTokens).toContain(
      "rounded-[1.5rem] border border-black/5 bg-white/48 p-1 sm:rounded-[2rem] sm:p-1.5",
    );
    expect(layoutTokens).toContain(
      "rounded-[1.2rem] bg-[#fcfcfa]/92 p-3 sm:rounded-[1.55rem] sm:p-5",
    );
    expect(page).toContain(
      "mt-3 rounded-[1.1rem] border border-black/5 bg-white/70 p-2 sm:mt-4 sm:rounded-[1.35rem] sm:p-3",
    );
    expect(page).toContain("h-10 min-w-0 flex-1");
    expect(page).toContain("text-[0.82rem]");
    expect(page).toContain("sm:h-11");
    expect(page).toContain("size-10 rounded-full");
    expect(page).toContain("sm:size-11");
    expect(page).not.toContain("customer logos");
    expect(page).not.toContain("Talk to an engineer");
  });

  it("keeps article cards visually aligned while removing redundant footer labels", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");
    const layoutTokens = fs.readFileSync(
      "apps/web/lib/layout-tokens.ts",
      "utf8",
    );

    expect(page).toContain("grid items-start gap-4 sm:gap-5");
    expect(page).toContain(
      'className={cn("group", getCardSurfaceClassName())}',
    );
    expect(layoutTokens).toContain(
      "rounded-[1.35rem] border border-black/5 bg-white/50 p-1 sm:rounded-[1.65rem] sm:p-1.5",
    );
    expect(page).toContain(
      "flex flex-col gap-2.5 rounded-[1.05rem] bg-[#fcfcfa]/92 p-4 sm:gap-3 sm:rounded-[1.25rem] sm:p-5",
    );
    expect(page).toContain(
      "line-clamp-1 text-[0.95rem] font-semibold leading-6 sm:text-base sm:leading-7",
    );
    expect(page).toContain(
      "line-clamp-3 text-[0.85rem] leading-5 sm:text-sm sm:leading-6",
    );
    expect(page).not.toContain('className="min-h-[4.5rem]"');
    expect(page).not.toContain("text.viewArticle");
    expect(page).not.toContain("text.currentLocaleZh");
    expect(page).not.toContain("text.currentLocaleEn");
  });

  it("keeps card metadata readable under long English labels by separating badges from timestamps", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");

    expect(page).toContain('className="flex items-center justify-between"');
    expect(page).toContain("tracking-[0.18em] text-zinc-400");
    expect(page).toContain("article.sourceName.toUpperCase()");
  });

  it("removes locale and read-more copy from homepage card text", () => {
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8");

    expect(copy).not.toContain("currentLocaleZh");
    expect(copy).not.toContain("currentLocaleEn");
    expect(copy).not.toContain("viewArticle");
  });
});
