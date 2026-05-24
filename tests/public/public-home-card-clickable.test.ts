import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("public homepage cards", () => {
  it("keeps the article card clickable without forcing equal-height whitespace", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");
    const layoutTokens = fs.readFileSync(
      "apps/web/lib/layout-tokens.ts",
      "utf8",
    );

    expect(page).toContain(
      'className={cn("group", getCardSurfaceClassName())}',
    );
    expect(layoutTokens).toContain(
      "rounded-[1.65rem] border border-black/5 bg-white/50 p-1.5",
    );
    expect(page).toContain(
      'className="flex flex-col gap-3 rounded-[1.25rem] bg-[#fcfcfa]/92 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60',
    );
    expect(page).toContain("group-hover:text-emerald-950");
    expect(page).not.toContain("flex h-full flex-col gap-4");
    expect(page).not.toContain("{text.viewArticle}");
    expect(page).not.toContain(
      'className="font-medium text-emerald-100 transition-colors hover:text-emerald-50"',
    );
  });
});
