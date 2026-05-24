export function buildSummaryPreviewText(markdown: string) {
  return markdown
    .replace(/```([\s\S]*?)```/g, (_match, code: string) =>
      code.replace(/^\s*[\w-]+\s*\n/, "").trim(),
    )
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|\>|\-|\*|\+)\s?/gm, "")
    .replace(/^\s{0,3}\d+\.\s+/gm, "")
    .replace(/(\*\*|__|\*|_)/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(
      /^(summary|摘要|key security development|关键安全发展|core security event|核心安全事件|important|重要性)\s*[:：-]\s*/i,
      "",
    )
    .trim();
}
