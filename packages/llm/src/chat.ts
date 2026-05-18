type ChatCompletionContentPart = {
  type?: string
  text?: string
}

type ChatCompletionChoice = {
  message?: {
    content?: string | ChatCompletionContentPart[] | null
  } | null
}

type ChatCompletionResult = {
  choices?: ChatCompletionChoice[]
}

export type ChatCompletionsClient = {
  chat: {
    completions: {
      create(input: {
        model: string
        messages: Array<{
          role: "user"
          content: string
        }>
      }): Promise<ChatCompletionResult>
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function createChatCompletionTextWithRetry(input: {
  client: ChatCompletionsClient
  model: string
  prompt: string
  maxAttempts?: number
  retryDelayMs?: number
}) {
  const maxAttempts = input.maxAttempts ?? 3
  const retryDelayMs = input.retryDelayMs ?? 250
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await input.client.chat.completions.create({
        model: input.model,
        messages: [
          {
            role: "user",
            content: input.prompt,
          },
        ],
      })

      return extractChatCompletionText(result)
    } catch (error) {
      lastError = error

      if (attempt >= maxAttempts) {
        break
      }

      await wait(retryDelayMs * attempt)
    }
  }

  throw lastError
}

export function extractChatCompletionText(result: ChatCompletionResult) {
  const content = result.choices?.[0]?.message?.content

  if (typeof content === "string") {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim()
  }

  return ""
}
