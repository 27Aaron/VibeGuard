import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("API endpoint card spacing", () => {
  it("keeps the endpoint card body on a shared gap stack without extra trailing margins", () => {
    const component = fs.readFileSync(
      "apps/web/app/[lang]/api/endpoint-card.tsx",
      "utf8",
    );

    expect(component).toContain('className="flex flex-col gap-3"');
    expect(component).toContain('className="flex items-center gap-2.5"');
    expect(component).toContain(
      'className="text-xs leading-relaxed text-zinc-600 dark:text-stone-400"',
    );
    expect(component).toContain('className="flex flex-wrap gap-1.5"');
    expect(component).not.toContain("mb-3");
  });
});
