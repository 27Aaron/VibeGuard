import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
} from "./chat";

import { stripJsonFence, tryParseJsonCandidates, resolvePrompt } from "./utils";
import { wrapSourceText } from "./prompts";

export type RelevanceResult = {
  relevant: boolean;
  reason: string;
};

const DEFAULT_RELEVANCE_PROMPT =
  "判断以下文章是否与软件供应链安全、开源安全、依赖安全、恶意包、漏洞利用等相关。只输出 JSON：{\"relevant\": true/false, \"reason\": \"简短理由\"}";

const MAX_SOURCE_LENGTH = 4000;

function safeSlice(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  let end = maxChars;
  // Step back to avoid splitting a multi-byte character
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
  const prompt = resolveRelevancePrompt(input.systemPrompt);
  const truncated = safeSlice(input.sourceText, MAX_SOURCE_LENGTH);

  return wrapSourceText(prompt, truncated);
}

export function resolveRelevancePrompt(value: string | null | undefined) {
  return resolvePrompt(value, DEFAULT_RELEVANCE_PROMPT);
}

export async function classifyRelevance(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt: string;
  sourceText: string;
}): Promise<RelevanceResult> {
  const prompt = buildRelevancePrompt({
    systemPrompt: input.systemPrompt,
    sourceText: input.sourceText,
  });

  const text = await createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    prompt,
  });

  const result = parseRelevanceResponse(text);

  if (result) {
    return result;
  }

  // 解析失败时默认认为相关，避免误过滤
  return { relevant: true, reason: "Failed to parse relevance response" };
}
