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

type ChatMessage = {
  role: "system" | "user"
  content: string
}

export type ChatCompletionsClient = {
  chat: {
    completions: {
      create(input: {
        model: string
        messages: Array<ChatMessage>
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
  systemPrompt?: string
  userContent: string
  maxAttempts?: number
  retryDelayMs?: number
}) {
  const maxAttempts = input.maxAttempts ?? 3
  const retryDelayMs = input.retryDelayMs ?? 250
  let lastError: unknown = new Error("Unknown error")

  const messages: ChatMessage[] = []
  if (input.systemPrompt) {
    messages.push({ role: "system", content: input.systemPrompt })
  }
  messages.push({ role: "user", content: input.userContent })

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await input.client.chat.completions.create({
        model: input.model,
        messages,
      })

      return extractChatCompletionText(result)
    } catch (error) {
      lastError = error

      if (attempt >= maxAttempts) {
        break
      }

      await wait(retryDelayMs * Math.pow(2, attempt - 1))
    }
  }

  throw lastError
}

function stripThinkingTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<think[\s\S]*?(<\/think>|$)/g, "")
    .trim()
}

function extractChatCompletionText(result: ChatCompletionResult) {
  const content = result.choices?.[0]?.message?.content

  let text: string

  if (typeof content === "string") {
    text = content.trim()
  } else if (Array.isArray(content)) {
    text = content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim()
  } else {
    return ""
  }

  return stripThinkingTags(text)
}
