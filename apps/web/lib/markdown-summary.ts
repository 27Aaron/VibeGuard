export function normalizeSummaryMarkdownHeadings(markdown: string) {
  let inFencedCodeBlock = false

  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (isFenceLine(line)) {
        inFencedCodeBlock = !inFencedCodeBlock
        return line
      }

      if (inFencedCodeBlock) {
        return line
      }

      return removeSummaryHeadingMarker(line)
    })
    .join("\n")
}

function removeSummaryHeadingMarker(line: string) {
  const match = line.match(/^ {0,3}#{1,2}[ \t]+(.+?)\s*$/)

  if (!match) {
    return line
  }

  return (match[1] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim()
}

function isFenceLine(line: string) {
  return /^ {0,3}(```|~~~)/.test(line)
}
