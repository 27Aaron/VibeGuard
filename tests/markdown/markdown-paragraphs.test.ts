import { createElement, isValidElement } from "../../apps/web/node_modules/react/index.js"

import { describe, expect, it } from "vitest"

import { renderMarkdownParagraph } from "../../apps/web/lib/markdown-paragraphs"

describe("renderMarkdownParagraph", () => {
  it("keeps raw image nodes outside paragraph tags before the markdown img renderer expands them", () => {
    const result = renderMarkdownParagraph(
      [
        createElement("strong", { key: "intro" }, "StepSecurity 发现了新的供应链攻击。"),
        createElement("img", {
          key: "image",
          src: "https://cdn.example.com/attack.png",
          alt: "",
        }),
      ],
      "body-copy",
    ) as { props?: { children?: unknown[] } }

    expect(isValidElement(result)).toBe(true)
    expect(result.props?.children).toHaveLength(2)

    const [textParagraph, imageNode] = result.props?.children as Array<{
      type: unknown
      props?: { className?: string }
    }>

    expect(textParagraph.type).toBe("p")
    expect(textParagraph.props?.className).toBe("body-copy")
    expect(imageNode.type).toBe("img")
  })

  it("keeps figures outside paragraph tags when markdown mixes text and images", () => {
    const result = renderMarkdownParagraph(
      [
        createElement("strong", { key: "intro" }, "StepSecurity 发现了新的供应链攻击。"),
        createElement(
          "figure",
          { key: "image" },
          createElement("img", { src: "https://cdn.example.com/attack.png", alt: "" }),
        ),
      ],
      "body-copy",
    ) as { props?: { children?: unknown[] } }

    expect(isValidElement(result)).toBe(true)
    expect(result.props?.children).toHaveLength(2)

    const [textParagraph, imageFigure] = result.props?.children as Array<{
      type: unknown
      props?: { className?: string }
    }>

    expect(textParagraph.type).toBe("p")
    expect(textParagraph.props?.className).toBe("body-copy")
    expect(imageFigure.type).toBe("figure")
  })

  it("does not wrap figure-only paragraphs in a paragraph tag", () => {
    const result = renderMarkdownParagraph(
      createElement(
        "figure",
        null,
        createElement("img", { src: "https://cdn.example.com/only-image.png", alt: "" }),
      ),
      "body-copy",
    ) as { props?: { children?: unknown[] } }

    expect(isValidElement(result)).toBe(true)
    const imageFigure = result.props?.children as { type: unknown }
    expect(imageFigure.type).toBe("figure")
  })

  it("uses the markdown paragraph node to keep custom image renderers outside paragraph tags", () => {
    const MarkdownImage = () => null
    const paragraphNode = {
      type: "element",
      tagName: "p",
      children: [
        { type: "text", value: "intro" },
        { type: "element", tagName: "img", properties: { src: "https://cdn.example.com/a.png" } },
      ],
    }

    const result = renderMarkdownParagraph(
      [
        createElement("strong", { key: "intro" }, "StepSecurity 发现了新的供应链攻击。"),
        createElement(MarkdownImage, { key: "image" }),
      ],
      "body-copy",
      paragraphNode,
    ) as { props?: { children?: unknown[] } }

    expect(isValidElement(result)).toBe(true)
    expect(result.props?.children).toHaveLength(2)

    const [textParagraph, imageNode] = result.props?.children as Array<{
      type: unknown
      props?: { className?: string }
    }>

    expect(textParagraph.type).toBe("p")
    expect(textParagraph.props?.className).toBe("body-copy")
    expect(imageNode.type).toBe(MarkdownImage)
  })
})
