import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
  type UsageResult,
} from "./chat";

import { stripJsonFence, tryParseJsonCandidates, resolvePrompt } from "./utils";

export type RelevanceResult = {
  relevant: boolean;
  reason: string;
};

const DEFAULT_RELEVANCE_PROMPT =
  `Determine whether the following article is relevant to software supply-chain security, open-source security, dependency safety, malicious packages, or vulnerability exploitation.

Relevant topics include: typosquatting, dependency confusion, account takeover targeting package registries, malicious npm/PyPI/crates/etc. packages, CI/CD pipeline attacks, build-system compromises, code-signing or signature verification issues, dependency hijacking, and similar threats.

NOT relevant: general cybersecurity news with no supply-chain angle, pure application-layer bugs (XSS, SQLi) with no package/dependency component, non-technical news.

Output ONLY valid JSON: {"relevant": true/false, "reason": "one-sentence explanation"}`;

const MAX_SOURCE_LENGTH = 4000;

function safeSlice(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  let end = maxChars;
  // 向前回退，避免在多字节字符（如中文、emoji）的中间位置截断，导致产生无效的 Unicode 字符串
  while (end > 0 && (text.charCodeAt(end) & 0xfc00) === 0xdc00) {
    end -= 1;
  }
  return text.slice(0, end);
}

interface RawRelevanceResponse {
  relevant?: unknown
  reason?: unknown
}

function parseRelevanceResponse(value: string): RelevanceResult | null {
  const stripped = stripJsonFence(value);
  const candidates = [
    stripped,
    stripped.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  const parsed = tryParseJsonCandidates(candidates);

  if (typeof parsed === "object" && parsed !== null && "relevant" in parsed) {
    const raw = parsed as RawRelevanceResponse;
    return {
      relevant: Boolean(raw.relevant),
      reason: typeof raw.reason === "string" ? raw.reason : "",
    };
  }

  return null;
}

function buildRelevancePrompt(input: {
  systemPrompt: string;
  sourceText: string;
}) {
  return {
    systemPrompt: resolveRelevancePrompt(input.systemPrompt),
    userContent: safeSlice(input.sourceText, MAX_SOURCE_LENGTH),
  }
}

export function resolveRelevancePrompt(value: string | null | undefined) {
  return resolvePrompt(value, DEFAULT_RELEVANCE_PROMPT);
}

export async function classifyRelevance(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt: string;
  sourceText: string;
}): Promise<{ result: RelevanceResult; usage: UsageResult | null }> {
  const { systemPrompt, userContent } = buildRelevancePrompt({
    systemPrompt: input.systemPrompt,
    sourceText: input.sourceText,
  });

  const { text, usage } = await createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    systemPrompt,
    userContent,
  });

  const parsed = parseRelevanceResponse(text);

  const result = parsed ?? { relevant: false, reason: "Failed to parse relevance response" };

  return { result, usage };
}
