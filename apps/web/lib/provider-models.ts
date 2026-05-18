import type { AppLang } from "./i18n"

export function buildModelAvailabilityMessage(input: {
  profileName: string
  model: string
  modelFound: boolean
  lang?: AppLang
}) {
  const lang = input.lang ?? "zh"
  return input.modelFound
    ? lang === "zh"
      ? `${input.profileName} 连接成功，且可用模型列表中包含 ${input.model}。`
      : `${input.profileName} connected successfully, and ${input.model} appears in the available model list.`
    : lang === "zh"
      ? `${input.profileName} 连接成功，但模型服务的 /v1/models 未返回 ${input.model}。只要该模型服务实际支持这个模型，你仍然可以保存并继续使用。`
      : `${input.profileName} connected successfully, but the model service did not return ${input.model} from /v1/models. You can still save and use it if the provider supports it.`
}

export function mergeModelOptions(currentModel: string, models: string[]) {
  const normalized = [...new Set(models.map((model) => model.trim()).filter(Boolean))]

  if (currentModel.trim() && !normalized.includes(currentModel.trim())) {
    return [currentModel.trim(), ...normalized]
  }

  return normalized
}

export function normalizeProviderErrorMessage(input: {
  error: unknown
  baseUrl: string
  action: "listModels" | "testConnection"
  lang?: AppLang
}) {
  const lang = input.lang ?? "zh"
  const fallback =
    input.action === "listModels"
      ? lang === "zh"
        ? "获取模型列表失败。"
        : "Failed to load the model list."
      : lang === "zh"
        ? "使用当前保存的凭证访问模型服务失败。"
        : "Failed to access the model service with the saved credentials."

  if (!(input.error instanceof Error)) {
    return fallback
  }

  const message = input.error.message
  const compactMessage = message.replace(/\s+/g, " ").trim()

  if (
    compactMessage.includes("404 Not Found") &&
    compactMessage.toLowerCase().includes("openresty")
  ) {
    return lang === "zh"
      ? `模型服务返回了 404 页面，通常说明 Base URL 填的不是 API 根地址。请填写类似 ${buildSuggestedBaseUrl(
          input.baseUrl,
        )} 这样的地址，而不是具体接口路径。`
      : `The model service returned a 404 page, which usually means the Base URL is not the API root. Use an address like ${buildSuggestedBaseUrl(
          input.baseUrl,
        )} instead of a concrete endpoint path.`
  }

  return compactMessage || fallback
}

function buildSuggestedBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim()

  if (!trimmed) {
    return "https://api.openai.com/v1"
  }

  try {
    const url = new URL(trimmed)
    url.pathname = "/v1"
    url.search = ""
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  } catch {
    return "https://api.openai.com/v1"
  }
}
