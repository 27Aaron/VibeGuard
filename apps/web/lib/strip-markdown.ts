export function stripMarkdown(value: string): string {
  return (
    value
      // fenced code blocks
      .replace(/```[\s\S]*?```/g, "")
      // inline code
      .replace(/`([^`]+)`/g, "$1")
      // images
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      // links: [text](url) → text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // headings
      .replace(/^#{1,6}\s+/gm, "")
      // bold / italic
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/___([^_]+)___/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // strikethrough
      .replace(/~~([^~]+)~~/g, "$1")
      // blockquotes
      .replace(/^>\s+/gm, "")
      // unordered list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      // ordered list markers
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // HTML tags
      .replace(/<[^>]+>/g, "")
      // collapse whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}
