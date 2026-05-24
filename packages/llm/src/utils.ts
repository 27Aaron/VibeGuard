export function stripJsonFence(value: string) {
  let result = value.trim();

  // 循环移除所有 Markdown 代码围栏标记（包括开头和结尾的 ``` 及可选的 json 语言标识）
  while (result.startsWith("```")) {
    result = result.replace(/^```(?:json)?\s*/i, "");
  }
  while (result.endsWith("```")) {
    result = result.replace(/\s*```$/i, "");
  }

  return result.trim();
}

export function tryParseJsonCandidates(candidates: string[]): unknown | null {
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // 当前候选字符串解析失败，继续尝试下一个候选字符串
    }
  }

  return null;
}

export function resolvePrompt(
  value: string | null | undefined,
  fallback: string,
) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return fallback;
  }

  return normalized;
}
