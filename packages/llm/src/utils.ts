export function stripJsonFence(value: string) {
  let result = value.trim();

  // Remove all code fences (opening and closing) iteratively
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
      return JSON.parse(candidate)
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

export function resolvePrompt(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? "").trim()

  if (!normalized) {
    return fallback
  }

  return normalized
}
