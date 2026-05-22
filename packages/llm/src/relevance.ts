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

function parseRelevanceResponse(value: string): RelevanceResult | null {
  const stripped = stripJsonFence(value);
  const candidates = [
    stripped,
    stripped.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  const parsed = tryParseJsonCandidates(candidates);

  if (typeof parsed === "object" && parsed !== null && "relevant" in parsed) {
    return {
      relevant: Boolean((parsed as Record<string, unknown>).relevant),
      reason: typeof (parsed as Record<string, unknown>).reason === "string" ? (parsed as Record<string, unknown>).reason as string : "",
    };
  }

  return null;
}

function buildRelevancePrompt(input: {
  systemPrompt: string;
  sourceText: string;
}) {
  const prompt = resolveRelevancePrompt(input.systemPrompt);
  const truncated = input.sourceText.slice(0, MAX_SOURCE_LENGTH);

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
