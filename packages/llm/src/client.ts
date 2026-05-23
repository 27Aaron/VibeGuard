import OpenAI from "openai";

export type OpenAIClientConfig = {
  baseUrl: string;
  apiKey: string;
};

export function createOpenAIClient(config: OpenAIClientConfig) {
  if (!config.apiKey) {
    throw new Error("API key is required to create an OpenAI client.");
  }

  return new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
}
