import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("public homepage grid", () => {
  it("renders the article stream as a three-column grid on large screens", () => {
    const page = fs.readFileSync("apps/web/app/[lang]/page.tsx", "utf8");

    expect(page).toContain(
      "grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3",
    );
  });
});
