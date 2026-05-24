import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("public homepage pagination", () => {
  it("keeps pagination below the article list with visible page numbers", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");
    const layoutTokens = fs.readFileSync(
      "apps/web/lib/layout-tokens.ts",
      "utf8",
    );
    const emptyStateBoundary = page.indexOf("{feed.items.length === 0");
    const paginationUsage = page.indexOf("<PaginationControls");

    expect(layoutTokens).toContain("px-4 pb-8 pt-4");
    expect(page).toContain(
      '<footer className="flex justify-center border-t border-black/5 pt-4',
    );
    expect(paginationUsage).toBeGreaterThan(emptyStateBoundary);
    expect(page).toContain("<PaginationControls");
    expect(page).toContain("currentPage={currentPage}");
    expect(page).toContain("totalPages={totalPages}");
    expect(page).toContain("<PageSelect");
    expect(page).not.toContain("text.pageFooter");
  });

  it("removes the homepage footer timestamp note from copy", () => {
    const copy = fs.readFileSync("apps/web/lib/i18n.ts", "utf8");

    expect(copy).not.toContain("pageFooter");
    expect(copy).not.toContain("所有时间均按北京时间展示");
    expect(copy).not.toContain("All timestamps are shown in Beijing time");
  });
});
