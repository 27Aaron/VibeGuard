import type { AppLang } from "./i18n";

export function normalizeUserFacingError(error: unknown, lang: AppLang = "zh") {
  const fallback =
    lang === "zh"
      ? "操作失败，请稍后重试。"
      : "The operation failed. Please try again.";

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.replace(/\s+/g, " ").trim();

  if (!message) {
    return fallback;
  }

  if (message.includes("No active LLM settings found")) {
    return lang === "zh"
      ? "还没有生效中的模型配置。请先到设置页启用一套可用模型。"
      : "There is no active model profile yet. Enable one from Settings first.";
  }

  if (message.includes("could not be decrypted")) {
    return lang === "zh"
      ? "当前生效模型的 API Key 无法解密。请重新保存这套模型配置。"
      : "The API key for the active model profile could not be decrypted. Save the profile again.";
  }

  if (message.includes("Article not found")) {
    return lang === "zh" ? "未找到对应文章。" : "Article not found.";
  }

  if (message.includes("Request to") && message.includes("status 401")) {
    return lang === "zh"
      ? "访问模型服务失败：API Key 可能无效或已过期。"
      : "Model service access failed: the API key may be invalid or expired.";
  }

  if (message.includes("Request to") && message.includes("status 403")) {
    return lang === "zh"
      ? "访问模型服务被拒绝，请检查权限、额度或服务端策略。"
      : "Access to the model service was denied. Check permissions, quotas, or service-side policies.";
  }

  if (message.includes("Request to") && message.includes("status 404")) {
    return lang === "zh"
      ? "请求的服务接口不存在，请检查模型服务地址或接口兼容性。"
      : "The requested service endpoint does not exist. Check the model service URL or API compatibility.";
  }

  if (message.includes("Request to") && message.includes("status 429")) {
    return lang === "zh"
      ? "模型服务当前限流，请稍后重试。"
      : "The model service is rate limited. Please try again later.";
  }

  if (message.includes("Request to") && message.includes("status 500")) {
    return lang === "zh"
      ? "模型服务暂时异常，请稍后重试。"
      : "The model service is temporarily unavailable. Please try again later.";
  }

  if (
    message.includes("404 Not Found") &&
    message.toLowerCase().includes("openresty")
  ) {
    return lang === "zh"
      ? "模型服务返回了 404 页面，通常说明 Base URL 不是 API 根地址。"
      : "The model service returned a 404 page. This usually means the Base URL is not the API root.";
  }

  if (message.includes("fetch failed")) {
    return lang === "zh"
      ? "网络请求失败，请检查当前网络、模型服务地址或目标站点可访问性。"
      : "The network request failed. Check connectivity, the model service URL, or target site availability.";
  }

  if (message.includes("该来源已暂停")) {
    return message;
  }

  if (message.includes("未找到该来源")) {
    return message;
  }

  if (message.includes("缺少 Feed ID")) {
    return lang === "zh"
      ? "缺少来源标识，请刷新页面后重试。"
      : "The source identifier is missing. Refresh the page and try again.";
  }

  if (
    message.includes("新建 Provider 配置时必须填写 API Key") ||
    message.includes("新建模型配置时必须填写 API Key")
  ) {
    return lang === "zh"
      ? "新建模型配置时必须填写 API Key。"
      : "An API key is required when creating a new model profile.";
  }

  // 生产环境下返回通用错误信息，避免将内部错误细节（如堆栈跟踪、数据库错误等）泄露给用户。
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }

  return message;
}
