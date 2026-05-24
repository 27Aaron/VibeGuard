import OpenAI from "openai";

import {
  type LlmRetryConfig,
  resolveLlmRetryConfig,
} from "./retry-policy";

export type OpenAIClientConfig = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryConfig?: LlmRetryConfig;
};

export function resolveOpenAIClientOptions(config: OpenAIClientConfig) {
  if (!config.apiKey) {
    throw new Error("API key is required to create an OpenAI client.");
  }

  const retryConfig =
    config.retryConfig ??
    resolveLlmRetryConfig({
      timeoutMs: config.timeoutMs,
    });

  return {
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    timeout: retryConfig.timeoutMs,
    maxRetries: config.maxRetries ?? 0,
  } satisfies ConstructorParameters<typeof OpenAI>[0];
}

export function createOpenAIClient(config: OpenAIClientConfig) {
  return new OpenAI({
    ...resolveOpenAIClientOptions(config),
  });
}
