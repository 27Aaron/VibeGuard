import { buildTranslationPrompt } from "./prompts";
import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
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
    // --- Step 1: Replace fenced code blocks ---
    // Match ```...``` blocks, including an optional language tag after the opening
    // backticks.  We use [\s\S]*? (non-greedy, crosses newlines) so a block ends
    // at the *first* closing ```.  The opening ``` may optionally be preceded by a
    // newline (the standard Markdown position) but can also appear mid-line in
    // real-world content.
    .replace(/```[^\n]*\n[\s\S]*?```/g, (match) => {
      const token = `__CF_CODE_BLOCK_${fencedIndex}__`;
      fencedIndex += 1;
      replacements.set(token, match);
      return token;
    })
    // --- Step 2: Replace inline code ---
    // Match single-backtick spans that do not contain backticks or newlines.
    // This runs after fenced block replacement so stray backtick-triples inside
    // inline code won't be misinterpreted as fences.
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
  const prompt = buildTranslationPrompt(
    input.systemPrompt,
    protectedMarkdown.protectedText,
  );
  const text = await createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    prompt,
  });

  return protectedMarkdown.restore(text);
}
