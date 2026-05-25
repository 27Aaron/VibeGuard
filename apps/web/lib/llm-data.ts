import { getDb, llmSettings } from "@vibeguard/db";
import {
  DEFAULT_TAG_PROMPT,
  resolveRelevancePrompt,
  resolveTagPrompt,
} from "@vibeguard/llm";
import { formatDateTimeInShanghai } from "./time";

export const DEFAULT_SUMMARY_PROMPT_EN =
  "Write a concise 2–4 sentence English summary of this supply-chain security article. Cover: (1) what happened, (2) which ecosystem or platform is affected, (3) the potential impact or defensive takeaway. Use concrete names from the article. Omit filler, speculation, and boilerplate. Return only the summary.";

export const DEFAULT_SUMMARY_PROMPT_ZH =
  "Write a concise 2–4 sentence Simplified Chinese summary of this supply-chain security article. Cover: (1) what happened, (2) which ecosystem or platform is affected, (3) the potential impact or defensive takeaway. Use concrete names from the article. Omit filler, speculation, and boilerplate. Return only the summary.";

export { DEFAULT_TAG_PROMPT };

const LEGACY_TRANSLATION_CONTENT_PROMPT =
  "Translate the article body into natural Chinese. Preserve links, package names, version strings, code snippets, and technical terms when needed.";

const DEFAULT_TRANSLATION_CONTENT_PROMPT =
  "Translate the article body into natural, fluent Simplified Chinese. Preserve the original meaning precisely. Keep all technical accuracy; do not simplify, embellish, or paraphrase security terminology. Keep fenced code blocks, inline code, shell commands, configuration keys, package names, version strings, URLs, and file paths exactly unchanged.";

function normalizeLocalizedSummaryPrompt(input: {
  prompt: string | null | undefined;
  fallback: string;
}) {
  const normalized = String(input.prompt ?? "").trim();

  if (!normalized) {
    return input.fallback;
  }

  return normalized;
}

function normalizeTranslationContentPrompt(
  input: string | null | undefined,
) {
  const normalized = String(input ?? "").trim();

  if (!normalized || normalized === LEGACY_TRANSLATION_CONTENT_PROMPT) {
    return DEFAULT_TRANSLATION_CONTENT_PROMPT;
  }

  return normalized;
}

export function normalizeTagPrompt(input: string | null | undefined) {
  return resolveTagPrompt(input);
}

function normalizeRelevancePrompt(input: string | null | undefined) {
  return resolveRelevancePrompt(input);
}

async function getActiveLlmSettings() {
  const db = getDb();
  const row =
    (await db.query.llmSettings.findFirst({
      where: (table, { eq: whereEq }) => whereEq(table.isActive, true),
      orderBy: (table, { desc: orderDesc }) => [orderDesc(table.updatedAt)],
    })) ??
    (await db.query.llmSettings.findFirst({
      orderBy: (table, { desc: orderDesc }) => [orderDesc(table.updatedAt)],
    }));

  if (!row) {
    return buildDefaultLlmSettings();
  }

  return {
    id: row.id,
    providerName: "OpenAI",
    settingsName: row.name,
    baseUrl: row.baseUrl,
    hasStoredApiKey: true,
    model: row.model,
    isActive: row.isActive,
    translationTitlePrompt: row.translateTitlePrompt,
    translationContentPrompt: normalizeTranslationContentPrompt(
      row.translateContentPrompt,
    ),
    summaryPromptEn: normalizeLocalizedSummaryPrompt({
      prompt: row.summaryPromptEn,
      fallback: DEFAULT_SUMMARY_PROMPT_EN,
    }),
    summaryPromptZh: normalizeLocalizedSummaryPrompt({
      prompt: row.summaryPromptZh,
      fallback: DEFAULT_SUMMARY_PROMPT_ZH,
    }),
    tagPrompt: normalizeTagPrompt(row.tagPrompt),
    relevancePrompt: normalizeRelevancePrompt(row.relevancePrompt),
  };
}

function buildDefaultLlmSettings() {
  return {
    id: "",
    providerName: "OpenAI",
    settingsName: "default-openai",
    baseUrl: "https://api.openai.com/v1",
    hasStoredApiKey: false,
    model: "gpt-5-mini",
    isActive: true,
    translationTitlePrompt:
      "Translate the article title into concise, natural Simplified Chinese. Preserve brand names, product names, project names, and technical acronyms (e.g. npm, PyPI, GitHub Actions) in their original English form. Do not add explanations or parentheses.",
    translationContentPrompt: DEFAULT_TRANSLATION_CONTENT_PROMPT,
    summaryPromptEn: DEFAULT_SUMMARY_PROMPT_EN,
    summaryPromptZh: DEFAULT_SUMMARY_PROMPT_ZH,
    tagPrompt: DEFAULT_TAG_PROMPT,
    relevancePrompt: normalizeRelevancePrompt(null),
  };
}

export async function getLlmSettingsRows() {
  const db = getDb();
  const rows = await db.query.llmSettings.findMany({
    orderBy: (table, { desc: orderDesc }) => [
      orderDesc(table.isActive),
      orderDesc(table.updatedAt),
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    model: row.model,
    isActive: row.isActive,
    hasStoredApiKey: Boolean(row.apiKeyEncrypted),
    updatedAt: formatDateTime(row.updatedAt),
  }));
}

export async function getLlmSettingsDetail(profileId?: string) {
  if (!profileId || profileId === "new") {
    return profileId === "new"
      ? buildDefaultLlmSettings()
      : getActiveLlmSettings();
  }

  const db = getDb();
  const row = await db.query.llmSettings.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, profileId),
  });

  if (!row) {
    return getActiveLlmSettings();
  }

  return {
    id: row.id,
    providerName: "OpenAI",
    settingsName: row.name,
    baseUrl: row.baseUrl,
    hasStoredApiKey: true,
    model: row.model,
    isActive: row.isActive,
    translationTitlePrompt: row.translateTitlePrompt,
    translationContentPrompt: normalizeTranslationContentPrompt(
      row.translateContentPrompt,
    ),
    summaryPromptEn: normalizeLocalizedSummaryPrompt({
      prompt: row.summaryPromptEn,
      fallback: DEFAULT_SUMMARY_PROMPT_EN,
    }),
    summaryPromptZh: normalizeLocalizedSummaryPrompt({
      prompt: row.summaryPromptZh,
      fallback: DEFAULT_SUMMARY_PROMPT_ZH,
    }),
    tagPrompt: normalizeTagPrompt(row.tagPrompt),
    relevancePrompt: normalizeRelevancePrompt(row.relevancePrompt),
  };
}

function formatDateTime(
  value: Date | null | undefined,
  lang: "zh" | "en" = "zh",
  fallback?: string,
) {
  return formatDateTimeInShanghai(value, { lang, fallback });
}
