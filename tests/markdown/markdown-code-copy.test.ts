import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("markdown code block controls", () => {
  it("renders a copy action instead of the old code label", () => {
    const renderer = fs.readFileSync(
      "apps/web/components/content/markdown-renderer.tsx",
      "utf8",
    );

    expect(renderer).toContain("navigator.clipboard.writeText");
    expect(renderer).toContain("Copy");
    expect(renderer).toContain("Check");
    expect(renderer).toContain("text.copyCode");
    expect(renderer).toContain("text.copiedCode");
    expect(renderer).not.toContain("<span>{text.codeLabel}</span>");
  });

  it("defines localized copy labels", () => {
    const i18n = fs.readFileSync("apps/web/lib/i18n.ts", "utf8");

    expect(i18n).toContain('copyCode: "复制代码"');
    expect(i18n).toContain('copiedCode: "已复制"');
    expect(i18n).toContain('copyCode: "Copy code"');
    expect(i18n).toContain('copiedCode: "Copied"');
  });
});
