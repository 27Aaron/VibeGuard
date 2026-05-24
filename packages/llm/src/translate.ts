import { buildTranslationSystemPrompt } from "./prompts";
import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
  type UsageResult,
} from "./chat";

type ProtectedMarkdownCode = {
  protectedText: string;
  restore(text: string): string;
};

export function protectMarkdownCode(sourceText: string): ProtectedMarkdownCode {
  const replacements = new Map<string, string>();
  let fencedIndex = 0;
  let inlineIndex = 0;

  const protectedText = sourceText
    .replace(/```[^\n]*\n[\s\S]*?```/g, (match) => {
      const token = `__CF_CODE_BLOCK_${fencedIndex}__`;
      fencedIndex += 1;
      replacements.set(token, match);
      return token;
    })
    .replace(/`([^`\n]+)`/g, (match) => {
      const token = `__CF_INLINE_CODE_${inlineIndex}__`;
      inlineIndex += 1;
      replacements.set(token, match);
      return token;
    });

  return {
    protectedText,
    restore(text: string) {
      let result = text;
      for (const [token, original] of replacements) {
        result = result.replaceAll(token, original);
      }
      return result;
    },
  };
}

export async function translateText(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt: string;
  sourceText: string;
}) {
  const protectedMarkdown = protectMarkdownCode(input.sourceText);
  const systemPrompt = buildTranslationSystemPrompt(input.systemPrompt);
  const { text, usage } = await createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    systemPrompt,
    userContent: protectedMarkdown.protectedText,
  });

  return {
    result: protectedMarkdown.restore(text),
    usage,
  };
}
