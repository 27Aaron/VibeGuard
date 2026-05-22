export function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
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
