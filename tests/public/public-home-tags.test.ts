import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("public homepage tag filters", () => {
  it("uses a lightweight tag-only filter surface", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");
    const i18n = fs.readFileSync("apps/web/lib/i18n.ts", "utf8");
    const filter = fs.readFileSync(
      "apps/web/components/public-tag-filter.tsx",
      "utf8",
    );

    expect(page).toContain("PublicTagFilter");
    expect(page).toContain("getPublicTags");
    expect(page).toContain("tag?: string");
    expect(page).toContain('limit: "15"');
    expect(page).not.toContain("getPublicSources");
    expect(page).not.toContain("ARTICLE_ECOSYSTEM_VALUES");
    expect(page).not.toContain("ARTICLE_RISK_CATEGORY_VALUES");
    expect(page).not.toContain("getEcosystemLabel");
    expect(page).not.toContain("getRiskCategoryLabel");
    expect(i18n).toContain("搜索标题、摘要或标签");
    expect(i18n).toContain("Search titles, summaries, or tags");
    expect(filter).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(filter).toContain("flex-nowrap");
    expect(filter).toContain("overflow-x-auto");
    expect(filter).toContain("relative grid");
    expect(filter).toContain("-left-2 -right-2 top-full");
    expect(filter).toContain("mt-4");
    expect(filter).toContain('type="button"');
    expect(filter).toContain("aria-expanded");
    expect(filter).toContain("useEffect");
    expect(filter).toContain("useRef");
    expect(filter).toContain('"pointerdown"');
    expect(filter).toContain('"Escape"');
    expect(filter).toContain('role="dialog"');
    expect(filter).toContain("filteredPopoverTags");
    expect(filter).toContain("() => [...visibleTags, ...overflowTags]");
    expect(filter).not.toContain("<details");
    expect(filter).not.toContain("<summary");
  });
});
