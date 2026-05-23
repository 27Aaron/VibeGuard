export type ProviderPreset = {
  label: string
  baseUrl: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { label: "GLM CN", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { label: "GLM CN Coding Plan", baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4" },
  { label: "GLM Global", baseUrl: "https://api.z.ai/api/paas/v4" },
  { label: "GLM Global Coding Plan", baseUrl: "https://api.z.ai/api/coding/paas/v4" },
  { label: "MiniMax CN", baseUrl: "https://api.minimaxi.com/v1" },
  { label: "MiniMax Global", baseUrl: "https://api.minimax.io/v1" },
  { label: "Kimi (Moonshot)", baseUrl: "https://api.moonshot.cn/v1" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com" },
  { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { label: "自定义", baseUrl: "" },
]
