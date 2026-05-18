import OpenAI from "openai";

export type OpenAIClientConfig = {
  baseUrl: string;
  apiKey: string;
};

export function createOpenAIClient(config: OpenAIClientConfig) {
  return new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
}
