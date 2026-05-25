import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("getArticleById wrapped with React.cache()", () => {
  const page = fs.readFileSync(
    "apps/web/app/[lang]/articles/[articleId]/page.tsx",
    "utf8",
  );

  it("imports cache from react", () => {
    expect(page).toMatch(/import\s*\{\s*cache\s*\}\s*from\s*"react"/);
  });

  it("imports getArticleById under an alias to avoid name collision", () => {
    expect(page).toContain(
      'import { getArticleById as _getArticleById } from "@/lib/api-articles"',
    );
  });

  it("creates a cached version of getArticleById at module level", () => {
    expect(page).toContain("const getArticleById = cache(_getArticleById)");
  });

  it("does not call the raw (uncached) function directly", () => {
    // All calls should go through the cached wrapper, not the underscore-prefixed original
    const underscoredCalls = page.match(/_getArticleById\(/g);
    // Only the cache() call should reference _getArticleById
    expect(underscoredCalls).toBeNull();
  });
});

describe("SoftLink uses Next.js <Link> instead of router.push", () => {
  const softLink = fs.readFileSync(
    "apps/web/components/admin/soft-link.tsx",
    "utf8",
  );

  it("imports Link from next/link", () => {
    expect(softLink).toContain('import Link from "next/link"');
  });

  it("does not use useRouter from next/navigation", () => {
    expect(softLink).not.toContain("useRouter");
  });

  it("does not use router.push", () => {
    expect(softLink).not.toContain("router.push");
  });

  it("renders a <Link> element with prefetch enabled", () => {
    expect(softLink).toContain("<Link");
    expect(softLink).toContain("prefetch={true}");
  });

  it("passes scroll={false} to preserve the original non-scrolling behavior", () => {
    expect(softLink).toContain("scroll={false}");
  });

  it("renders a <span> for the disabled state (not a <button>)", () => {
    expect(softLink).not.toContain("<button");
    expect(softLink).toContain("<span");
  });
});

describe("public-header matches routes by path instead of label", () => {
  const header = fs.readFileSync(
    "apps/web/components/public-header.tsx",
    "utf8",
  );

  it("includes a route field in the surface links data", () => {
    expect(header).toContain('route: "/api"');
    expect(header).toContain('route: "/mcp"');
    expect(header).toContain('route: "/rss"');
    expect(header).toContain('route: "/skill"');
    expect(header).toContain('route: "/check"');
  });

  it("constructs href from item.route instead of item.label", () => {
    expect(header).toContain("item.route");
  });

  it("does not use label-based route matching (item.label === ...)", () => {
    // The old code used patterns like item.label === "RSS" for routing
    expect(header).not.toMatch(/item\.label\s*===\s*"RSS"/);
    expect(header).not.toMatch(/item\.label\s*===\s*"Check"/);
    expect(header).not.toMatch(/item\.label\s*===\s*"API"/);
    expect(header).not.toMatch(/item\.label\s*===\s*"MCP"/);
    expect(header).not.toMatch(/item\.label\s*===\s*"Skill"/);
  });

  it("uses route-based comparison for prefetch control", () => {
    expect(header).toContain('item.route === "/api"');
    expect(header).toContain('item.route === "/mcp"');
  });

  it("uses surface-based comparison for localized labels", () => {
    expect(header).toContain('item.surface === "check"');
  });
});

describe("search-toast guards against duplicate toasts", () => {
  const toast = fs.readFileSync(
    "apps/web/components/ui/search-toast.tsx",
    "utf8",
  );

  it("uses a ref to track the last shown toast", () => {
    expect(toast).toContain("useRef");
  });

  it("stores a composite key of status:message", () => {
    expect(toast).toContain("lastToastRef");
    expect(toast).toContain("`${status}:${message}`");
  });

  it("skips the toast when the key matches the previous one", () => {
    expect(toast).toContain("lastToastRef.current === key");
    expect(toast).toContain("return");
  });
});

describe("markdown-renderer pre component only unwraps code blocks", () => {
  const renderer = fs.readFileSync(
    "apps/web/components/content/markdown-renderer.tsx",
    "utf8",
  );

  it("has a check for code children before unwrapping", () => {
    expect(renderer).toContain("hasCodeChild");
  });

  it("preserves <pre> for non-code content", () => {
    expect(renderer).toContain("<pre");
    expect(renderer).toContain("whitespace-pre-wrap");
  });

  it("unwraps code-containing <pre> elements", () => {
    // The unwrapping should be conditional
    expect(renderer).toMatch(
      /hasCodeChild\s*\?\s*\(\s*<>\s*\{children\}\s*<\/>\s*\)/,
    );
  });
});

describe("error.tsx uses design tokens instead of hardcoded classes", () => {
  const errorPage = fs.readFileSync("apps/web/app/[lang]/error.tsx", "utf8");

  it("imports layout token functions", () => {
    expect(errorPage).toContain("getBackgroundClassName");
    expect(errorPage).toContain("getBackdropClassName");
    expect(errorPage).toContain("getShellClassName");
  });

  it("uses getBackgroundClassName for the main element", () => {
    expect(errorPage).toContain("className={getBackgroundClassName()}");
  });

  it("uses getBackdropClassName for the overlay", () => {
    expect(errorPage).toContain("className={getBackdropClassName()}");
  });

  it("does not contain hardcoded background gradient classes", () => {
    expect(errorPage).not.toContain("bg-[#f2f2f0]");
    expect(errorPage).not.toContain("dark:bg-[#070b0f]");
    expect(errorPage).not.toContain("background-image:linear-gradient");
  });
});

describe("Skill nav icon differentiated from homepage brand icon", () => {
  const header = fs.readFileSync(
    "apps/web/components/public-header.tsx",
    "utf8",
  );

  it("uses a different icon for the Skill nav item (not ShieldCheck)", () => {
    // ShieldCheck is used by the homepage brand logo
    // The Skill nav item should use a different icon
    const skillEntryPattern = /\{[^}]*surface:\s*"skill"[^}]*\}/;
    const skillEntry = header.match(skillEntryPattern)?.[0];
    expect(skillEntry).toBeDefined();
    expect(skillEntry).not.toContain("ShieldCheck");
  });

  it("imports Sparkles for the Skill nav item", () => {
    expect(header).toContain("Sparkles");
  });

  it("still uses ShieldCheck for the homepage brand icon", () => {
    // The brand logo area should still use ShieldCheck
    const brandIconPattern = /flex size-8[^>]*>[\s\S]*?<\/span>/;
    const brandSection = header.match(brandIconPattern)?.[0];
    expect(brandSection).toBeDefined();
    expect(brandSection).toContain("ShieldCheck");
  });
});

describe("Skill install command copy", () => {
  const skillPage = fs.readFileSync(
    "apps/web/app/[lang]/skill/page.tsx",
    "utf8",
  );

  it("points users directly at the raw Skill markdown file path", () => {
    expect(skillPage).toContain(
      "帮我安装这个 skill：https://github.com/27Aaron/VibeGuard/blob/main/skill/vibeguard/SKILL.md",
    );
    expect(skillPage).toContain(
      "Install this skill: https://github.com/27Aaron/VibeGuard/blob/main/skill/vibeguard/SKILL.md",
    );
  });
});
