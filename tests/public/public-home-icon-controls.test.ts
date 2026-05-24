import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("public homepage icon controls", () => {
  it("uses icon-only actions for search, clear, and pagination controls", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");

    expect(page).toContain("Search");
    expect(page).toContain("ChevronLeft");
    expect(page).toContain("ChevronRight");
    expect(page).toContain(
      'buttonVariants({ size: "icon", variant: "outline" })',
    );
    expect(page).toContain(
      'buttonVariants({ size: "sm", variant: "outline" })',
    );
    expect(page).toContain("aria-label={text.search}");
    expect(page).toContain("previousLabel={text.pagePrev}");
    expect(page).toContain("nextLabel={text.pageNext}");
    expect(page).toContain("aria-label={previousLabel}");
    expect(page).toContain("aria-label={nextLabel}");
    expect(page).toContain('<ChevronLeft className="size-3.5" />');
    expect(page).toContain('<ChevronRight className="size-3.5" />');
  });
});
