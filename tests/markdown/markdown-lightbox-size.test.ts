import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("markdown lightbox sizing", () => {
  it("lets zoomed images use nearly the full viewport instead of the old 6xl cap", () => {
    const imageRenderer = fs.readFileSync(
      "apps/web/components/content/markdown-image.tsx",
      "utf8",
    );

    expect(imageRenderer).not.toContain("max-w-6xl");
    expect(imageRenderer).toContain("inline-flex max-h-[94vh] max-w-[96vw]");
    expect(imageRenderer).toContain("max-h-[94vh]");
    expect(imageRenderer).toContain("w-[min(96vw,1600px)]");
    expect(imageRenderer).toContain("cursor-zoom-out");
    expect(imageRenderer).toContain("onClick={onClose}");
  });

  it("animates lightbox open and close with a soft fade and scale transition", () => {
    const imageRenderer = fs.readFileSync(
      "apps/web/components/content/markdown-image.tsx",
      "utf8",
    );

    expect(imageRenderer).toContain("lightboxVisible");
    expect(imageRenderer).toContain("window.requestAnimationFrame");
    expect(imageRenderer).toContain("window.setTimeout");
    expect(imageRenderer).toContain("transition-opacity duration-220");
    expect(imageRenderer).toContain("transition-[opacity,transform] duration-220");
    expect(imageRenderer).toContain("ease-[cubic-bezier(0.22,1,0.36,1)]");
    expect(imageRenderer).toContain("scale-[0.994]");
  });
});
