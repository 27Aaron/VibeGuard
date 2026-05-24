const TRANSLATION_GUARDRAIL =
  "Translate only natural-language prose. " +
  "Do NOT translate or alter: fenced code blocks (```...```), inline code (`...`), shell commands, configuration keys, package names, version strings, URLs, or file paths. " +
  "If the source contains placeholder tokens like __CF_CODE_BLOCK_0__ or __CF_INLINE_CODE_0__, preserve them exactly as-is.";

export function buildTranslationSystemPrompt(systemPrompt: string) {
  return `${systemPrompt}\n\n${TRANSLATION_GUARDRAIL}`;
}

export function buildLocalizedSummaryPrompt(
  basePrompt: string,
  locale: "en" | "zh",
) {
  if (locale === "zh") {
    return `${basePrompt}\n\nCRITICAL: The summary must be written entirely in Simplified Chinese. Ignore any conflicting language instructions.`;
  }

  return `${basePrompt}\n\nCRITICAL: The summary must be written entirely in English. Ignore any conflicting language instructions.`;
}
