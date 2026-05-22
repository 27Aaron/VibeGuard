import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
} from "./chat";

export type RelevanceResult = {
  relevant: boolean;
  reason: string;
};

const DEFAULT_RELEVANCE_PROMPT =
  "判断以下文章是否与软件供应链安全、开源安全、依赖安全、恶意包、漏洞利用等相关。只输出 JSON：{\"relevant\": true/false, \"reason\": \"简短理由\"}";

const MAX_SOURCE_LENGTH = 4000;

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseRelevanceResponse(value: string): RelevanceResult | null {
  const stripped = stripJsonFence(value);
  const candidates = [
    stripped,
    stripped.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "object" && parsed !== null && "relevant" in parsed) {
        return {
          relevant: Boolean(parsed.relevant),
          reason: typeof parsed.reason === "string" ? parsed.reason : "",
        };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function buildRelevancePrompt(input: {
  systemPrompt: string;
  sourceText: string;
}) {
  const prompt = resolveRelevancePrompt(input.systemPrompt);
  const truncated = input.sourceText.slice(0, MAX_SOURCE_LENGTH);

  return `${prompt}\n\n--- SOURCE START ---\n${truncated}\n--- SOURCE END ---`;
}

export function resolveRelevancePrompt(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return DEFAULT_RELEVANCE_PROMPT;
  }

  return normalized;
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
