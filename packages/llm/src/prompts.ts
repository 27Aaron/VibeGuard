export function wrapSourceText(systemPrompt: string, sourceText: string) {
  return `${systemPrompt}\n\n--- SOURCE START ---\n${sourceText}\n--- SOURCE END ---`;
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
