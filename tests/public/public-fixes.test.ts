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

describe("public-header hides product-surface navigation", () => {
  const header = fs.readFileSync(
    "apps/web/components/public-header.tsx",
    "utf8",
  );

  it("does not define shared header links for API, MCP, RSS, Skill, or Check", () => {
    expect(header).not.toContain("futureSurfaceLinks");
    expect(header).not.toContain('{ label: "API"');
    expect(header).not.toContain('{ label: "MCP"');
    expect(header).not.toContain('{ label: "RSS"');
    expect(header).not.toContain('{ label: "Skill"');
    expect(header).not.toContain('{ label: "Check"');
    expect(header).not.toContain('route: "/api"');
    expect(header).not.toContain('route: "/mcp"');
    expect(header).not.toContain('route: "/rss"');
    expect(header).not.toContain('route: "/skill"');
    expect(header).not.toContain('route: "/check"');
  });

  it("does not construct nav hrefs from hidden surface metadata", () => {
    expect(header).not.toContain("item.route");
    expect(header).not.toContain("item.label");
    expect(header).not.toContain("item.surface");
  });

  it("does not use label-based route matching (item.label === ...)", () => {
    // The old code used patterns like item.label === "RSS" for routing
    expect(header).not.toMatch(/item\.label\s*===\s*"RSS"/);
    expect(header).not.toMatch(/item\.label\s*===\s*"Check"/);
    expect(header).not.toMatch(/item\.label\s*===\s*"API"/);
    expect(header).not.toMatch(/item\.label\s*===\s*"MCP"/);
    expect(header).not.toMatch(/item\.label\s*===\s*"Skill"/);
  });

  it("does not keep prefetch control for hidden API or MCP header links", () => {
    expect(header).not.toContain('item.route === "/api"');
    expect(header).not.toContain('item.route === "/mcp"');
    expect(header).not.toContain("prefetch={");
  });

  it("does not localize a hidden Check nav label", () => {
    expect(header).not.toContain('item.surface === "check"');
    expect(header).not.toContain("publicCheckNav");
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
  const codeBlock = fs.readFileSync(
    "apps/web/components/content/markdown-code-block.tsx",
    "utf8",
  );

  it("has a check for code children before unwrapping", () => {
    expect(codeBlock).toContain("hasCodeChild");
  });

  it("preserves <pre> for non-code content", () => {
    expect(codeBlock).toContain("<pre");
    expect(codeBlock).toContain("whitespace-pre-wrap");
  });

  it("unwraps code-containing <pre> elements", () => {
    // The unwrapping should be conditional
    expect(codeBlock).toMatch(
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

describe("public header brand icon remains after hiding Skill nav", () => {
  const header = fs.readFileSync(
    "apps/web/components/public-header.tsx",
    "utf8",
  );

  it("does not keep a Skill nav item in the shared header", () => {
    expect(header).not.toContain('surface: "skill"');
    expect(header).not.toContain('{ label: "Skill"');
    expect(header).not.toContain('route: "/skill"');
  });

  it("does not import the hidden Skill nav icon", () => {
    expect(header).not.toContain("Sparkles");
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
