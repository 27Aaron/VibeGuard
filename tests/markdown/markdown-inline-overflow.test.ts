import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("markdown article overflow guards", () => {
  const renderer = fs.readFileSync(
    "apps/web/components/content/markdown-renderer.tsx",
    "utf8",
  );

  it("treats no-language fenced code as a block instead of inline code", () => {
    expect(renderer).toContain("function isMarkdownCodeBlock");
    expect(renderer).toContain("node?.position?.start?.line");
    expect(renderer).toContain(
      "const inline = !isMarkdownCodeBlock(codeClassName, node);",
    );
    expect(renderer).toContain('codeBlockLanguage(codeClassName) || "text"');
  });

  it("prevents long inline code and fallback pre content from widening articles", () => {
    expect(renderer).toContain("[overflow-wrap:anywhere]");
    expect(renderer).toContain("whitespace-pre-wrap");
    expect(renderer).toContain("max-w-full");
  });
});
