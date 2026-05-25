import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("markdown article overflow guards", () => {
  const shared = fs.readFileSync(
    "apps/web/components/content/markdown-shared.ts",
    "utf8",
  );
  const codeBlock = fs.readFileSync(
    "apps/web/components/content/markdown-code-block.tsx",
    "utf8",
  );

  it("treats no-language fenced code as a block instead of inline code", () => {
    expect(shared).toContain("function isMarkdownCodeBlock");
    expect(shared).toContain("node?.position?.start?.line");
    expect(codeBlock).toContain(
      "const inline = !isMarkdownCodeBlock(codeClassName, node);",
    );
    expect(codeBlock).toContain('codeBlockLanguage(codeClassName) || "text"');
  });

  it("prevents long inline code and fallback pre content from widening articles", () => {
    expect(codeBlock).toContain("wrap-anywhere");
    expect(codeBlock).toContain("whitespace-pre-wrap");
    expect(codeBlock).toContain("max-w-full");
  });
});
