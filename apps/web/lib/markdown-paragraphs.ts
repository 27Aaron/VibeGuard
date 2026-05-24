import {
  Children,
  Fragment,
  createElement,
  isValidElement,
  type ReactNode,
} from "react";

function isFigureElement(node: ReactNode) {
  return (
    isValidElement(node) &&
    typeof node.type === "string" &&
    node.type === "figure"
  );
}

function isImageElement(node: ReactNode) {
  return (
    isValidElement(node) && typeof node.type === "string" && node.type === "img"
  );
}

function isBlockMediaElement(node: ReactNode) {
  return isFigureElement(node) || isImageElement(node);
}

type MarkdownParagraphNode = {
  children?: Array<{
    type?: string;
    tagName?: string;
  }>;
};

function isBlockMediaChildNode(
  node: { type?: string; tagName?: string } | undefined,
) {
  return (
    node?.type === "element" &&
    (node.tagName === "img" || node.tagName === "figure")
  );
}

export function renderMarkdownParagraph(
  children: ReactNode,
  className: string,
  node?: MarkdownParagraphNode,
) {
  const items = Children.toArray(children);
  const nodeChildren = Array.isArray(node?.children) ? node.children : [];
  const mediaIndexesFromNode = new Set(
    nodeChildren.flatMap((child, index) =>
      isBlockMediaChildNode(child) ? [index] : [],
    ),
  );

  if (!items.some(isBlockMediaElement) && mediaIndexesFromNode.size === 0) {
    return createElement("p", { className }, children);
  }

  const output: ReactNode[] = [];
  let inlineBuffer: ReactNode[] = [];

  const flushInlineBuffer = () => {
    if (!inlineBuffer.length) {
      return;
    }

    output.push(
      createElement(
        "p",
        { key: `paragraph-${output.length}`, className },
        inlineBuffer,
      ),
    );
    inlineBuffer = [];
  };

  for (const [index, item] of items.entries()) {
    if (isBlockMediaElement(item) || mediaIndexesFromNode.has(index)) {
      flushInlineBuffer();
      output.push(item);
      continue;
    }

    inlineBuffer.push(item);
  }

  flushInlineBuffer();

  return createElement(Fragment, null, ...output);
}
