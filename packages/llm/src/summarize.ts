import { buildSummaryPrompt } from "./prompts";
import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
} from "./chat";

const MAX_SUMMARY_SOURCE_LENGTH = 100_000;

export async function summarizeText(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt: string;
  sourceText: string;
}) {
  let sourceText = input.sourceText;

  if (sourceText.length > MAX_SUMMARY_SOURCE_LENGTH) {
    console.warn(
      `Summarize input truncated from ${sourceText.length} to ${MAX_SUMMARY_SOURCE_LENGTH} characters.`,
    );
    sourceText = sourceText.slice(0, MAX_SUMMARY_SOURCE_LENGTH);
  }

  const prompt = buildSummaryPrompt(input.systemPrompt, sourceText);
  return createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    prompt,
  });
}
