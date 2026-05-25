import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("markdown code block controls", () => {
  it("renders a copy action instead of the old code label", () => {
    const codeBlock = fs.readFileSync(
      "apps/web/components/content/markdown-code-block.tsx",
      "utf8",
    );

    expect(codeBlock).toContain("navigator.clipboard.writeText");
    expect(codeBlock).toContain("Copy");
    expect(codeBlock).toContain("Check");
    expect(codeBlock).toContain("copyCodeLabel");
    expect(codeBlock).toContain("copiedCodeLabel");
    expect(codeBlock).not.toContain("<span>{text.codeLabel}</span>");
  });

  it("defines localized copy labels", () => {
    const i18n = fs.readFileSync("apps/web/lib/i18n.ts", "utf8");

    expect(i18n).toContain('copyCode: "复制代码"');
    expect(i18n).toContain('copiedCode: "已复制"');
    expect(i18n).toContain('copyCode: "Copy code"');
    expect(i18n).toContain('copiedCode: "Copied"');
  });
});
