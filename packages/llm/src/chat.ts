import {
  getLlmHeaders,
  normalizeLlmError,
  parseRetryAfterMs,
  resolveLlmRetryConfig,
  resolveRetryDelayMs,
  type LlmRetryConfig,
} from "./retry-policy";

type ChatCompletionContentPart = {
  type?: string;
  text?: string;
};

type ChatCompletionChoice = {
  message?: {
    content?: string | ChatCompletionContentPart[] | null;
  } | null;
  finish_reason?: string;
};

type CompletionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
};

type ChatCompletionResult = {
  choices?: ChatCompletionChoice[];
  usage?: CompletionUsage;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export type PromptCacheRetention = "in_memory" | "24h";

export type PromptCacheOptions = {
  promptCacheKey?: string;
  promptCacheRetention?: PromptCacheRetention | null;
};

type ChatCompletionCreateInput = {
  model: string;
  messages: Array<ChatMessage>;
  prompt_cache_key?: string;
  prompt_cache_retention?: PromptCacheRetention | null;
};

type WaitFunction = (ms: number) => Promise<void>;

export type UsageResult = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  finishReason?: string;
};

export type ChatCompletionsClient = {
  chat: {
    completions: {
      create(input: ChatCompletionCreateInput): Promise<ChatCompletionResult>;
    };
  };
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractUsage(result: ChatCompletionResult): UsageResult | null {
  if (!result.usage) {
    return null;
  }

  return {
    promptTokens: result.usage.prompt_tokens ?? 0,
    completionTokens: result.usage.completion_tokens ?? 0,
    totalTokens: result.usage.total_tokens ?? 0,
    cachedTokens: result.usage.prompt_tokens_details?.cached_tokens,
    finishReason: result.choices?.[0]?.finish_reason,
  };
}

export async function createChatCompletionTextWithRetry(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt?: string;
  userContent: string;
  maxAttempts?: number;
  retryDelayMs?: number;
  retryConfig?: LlmRetryConfig;
  wait?: WaitFunction;
  random?: () => number;
} & PromptCacheOptions) {
  const retryConfig =
    input.retryConfig ??
    resolveLlmRetryConfig({
      maxAttempts: input.maxAttempts,
      retryBaseMs: input.retryDelayMs,
    });
  const waitFor = input.wait ?? wait;
  let lastError: unknown = new Error("Unknown error");

  const messages: ChatMessage[] = [];
  if (input.systemPrompt) {
    messages.push({ role: "system", content: input.systemPrompt });
  }
  messages.push({ role: "user", content: input.userContent });

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt += 1) {
    try {
      const request: ChatCompletionCreateInput = {
        model: input.model,
        messages,
      };

      const promptCacheKey = input.promptCacheKey?.trim();
      if (promptCacheKey) {
        request.prompt_cache_key = promptCacheKey;
      }

      if (input.promptCacheRetention !== undefined) {
        request.prompt_cache_retention = input.promptCacheRetention;
      }

      const result = await input.client.chat.completions.create(request);

      return {
        text: extractChatCompletionText(result),
        usage: extractUsage(result),
      };
    } catch (error) {
      const normalizedError = normalizeLlmError(error);
      lastError = normalizedError;

      if (!normalizedError.retryable || attempt >= retryConfig.maxAttempts) {
        break;
      }

      const retryAfterMs = parseRetryAfterMs(getLlmHeaders(error));
      const delayMs = resolveRetryDelayMs({
        attempt,
        baseMs: retryConfig.retryBaseMs,
        maxMs: retryConfig.retryMaxMs,
        retryAfterMs,
        random: input.random,
      });

      await waitFor(delayMs);
    }
  }

  throw normalizeLlmError(lastError);
}

function stripThinkingTags(text: string): string {
  return text
    .replace(/<think[\s\S]*?<\/think>/g, "")
    .replace(/<think[\s\S]*?(<\/think>|$)/g, "")
    .trim();
}

function extractChatCompletionText(result: ChatCompletionResult) {
  const content = result.choices?.[0]?.message?.content;

  let text: string;

  if (typeof content === "string") {
    text = content.trim();
  } else if (Array.isArray(content)) {
    text = content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  } else {
    return "";
  }

  return stripThinkingTags(text);
}
