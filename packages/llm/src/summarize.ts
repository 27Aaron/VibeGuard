import { buildLocalizedSummaryPrompt } from "./prompts";
import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
  type PromptCacheOptions,
  type UsageResult,
} from "./chat";

const MAX_SUMMARY_SOURCE_LENGTH = 100_000;

export async function summarizeText(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt: string;
  sourceText: string;
} & PromptCacheOptions) {
  let sourceText = input.sourceText;

  if (sourceText.length > MAX_SUMMARY_SOURCE_LENGTH) {
    console.warn(
      `Summarize input truncated from ${sourceText.length} to ${MAX_SUMMARY_SOURCE_LENGTH} characters.`,
    );
    sourceText = sourceText.slice(0, MAX_SUMMARY_SOURCE_LENGTH);
  }

  const { text, usage } = await createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    systemPrompt: input.systemPrompt,
    userContent: sourceText,
    promptCacheKey: input.promptCacheKey,
    promptCacheRetention: input.promptCacheRetention,
  });

  return { result: text, usage };
}
