import { buildSummaryPrompt } from "./prompts";
import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
} from "./chat";

export async function summarizeText(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt: string;
  sourceText: string;
}) {
  const prompt = buildSummaryPrompt(input.systemPrompt, input.sourceText);
  return createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    prompt,
  });
}
