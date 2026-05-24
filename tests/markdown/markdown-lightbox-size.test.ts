import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("markdown lightbox sizing", () => {
  it("lets zoomed images use nearly the full viewport instead of the old 6xl cap", () => {
    const renderer = fs.readFileSync(
      "apps/web/components/content/markdown-renderer.tsx",
      "utf8",
    );

    expect(renderer).not.toContain("max-w-6xl");
    expect(renderer).toContain("inline-flex max-h-[94vh] max-w-[96vw]");
    expect(renderer).toContain("max-h-[94vh]");
    expect(renderer).toContain("w-[min(96vw,1600px)]");
    expect(renderer).toContain("cursor-zoom-out");
    expect(renderer).toContain("onClick={closeLightbox}");
  });

  it("animates lightbox open and close with a soft fade and scale transition", () => {
    const renderer = fs.readFileSync(
      "apps/web/components/content/markdown-renderer.tsx",
      "utf8",
    );

    expect(renderer).toContain("lightboxVisible");
    expect(renderer).toContain("window.requestAnimationFrame");
    expect(renderer).toContain("window.setTimeout");
    expect(renderer).toContain("transition-opacity duration-220");
    expect(renderer).toContain("transition-[opacity,transform] duration-220");
    expect(renderer).toContain("ease-[cubic-bezier(0.22,1,0.36,1)]");
    expect(renderer).toContain("scale-[0.994]");
  });
});
