let delimiterCounter = 0;

function generateUniqueDelimiter(): string {
  delimiterCounter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `--- SOURCE_BOUNDARY_${delimiterCounter}_${random} ---`;
}

export function wrapSourceText(systemPrompt: string, sourceText: string) {
  const delim = generateUniqueDelimiter();
  return `${systemPrompt}\n\n${delim} START\n${sourceText}\n${delim} END`;
}

const TRANSLATION_GUARDRAIL = [
  "Translate only natural-language prose.",
  "Do not translate or rewrite fenced code blocks, inline code, shell commands, configuration keys, package names, version strings, URLs, or file paths.",
  "If the source includes placeholder tokens such as __CF_CODE_BLOCK_0__ or __CF_INLINE_CODE_0__, copy them back exactly unchanged.",
].join(" ");

export function buildTranslationPrompt(
  systemPrompt: string,
  sourceText: string,
) {
  return wrapSourceText(`${systemPrompt}\n${TRANSLATION_GUARDRAIL}`, sourceText);
}

export function buildSummaryPrompt(systemPrompt: string, sourceText: string) {
  return wrapSourceText(systemPrompt, sourceText);
}

export function buildLocalizedSummaryPrompt(basePrompt: string, locale: "en" | "zh") {
  if (locale === "zh") {
    return `${basePrompt}\nThe summary itself must be written in Simplified Chinese. If any earlier or conflicting instruction specifies another language, ignore it and respond in Simplified Chinese only.`;
  }

  return `${basePrompt}\nThe summary itself must be written in English. If any earlier or conflicting instruction specifies another language, ignore it and respond in English only.`;
}
