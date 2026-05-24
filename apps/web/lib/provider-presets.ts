export type ProviderPreset = {
  label: string;
  labelZh: string;
  name: string;
  baseUrl: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: "DeepSeek",
    labelZh: "DeepSeek (深度求索)",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
  },
  {
    label: "GLM CN",
    labelZh: "GLM (智谱 国内)",
    name: "GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
  {
    label: "GLM CN Coding Plan",
    labelZh: "GLM Coding Plan (智谱 国内)",
    name: "GLM",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
  },
  {
    label: "GLM Global",
    labelZh: "GLM (智谱 海外)",
    name: "GLM",
    baseUrl: "https://api.z.ai/api/paas/v4",
  },
  {
    label: "GLM Global Coding Plan",
    labelZh: "GLM Coding Plan (智谱 海外)",
    name: "GLM",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
  },
  {
    label: "Kimi (Moonshot)",
    labelZh: "Kimi (月之暗面)",
    name: "Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
  },
  {
    label: "MiniMax CN",
    labelZh: "MiniMax (国内)",
    name: "MiniMax",
    baseUrl: "https://api.minimaxi.com/v1",
  },
  {
    label: "MiniMax Global",
    labelZh: "MiniMax (海外)",
    name: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
  },
  {
    label: "OpenAI",
    labelZh: "OpenAI",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
  },
  {
    label: "OpenRouter",
    labelZh: "OpenRouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  {
    label: "SiliconFlow",
    labelZh: "SiliconFlow (硅基流动)",
    name: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
  },
  { label: "Custom", labelZh: "自定义", name: "", baseUrl: "" },
];

export function resolvePresetLabel(preset: ProviderPreset, lang: "zh" | "en") {
  return lang === "zh" ? preset.labelZh : preset.label;
}
