export function normalizeInt(value: string | undefined, fallback: number, minimum = 1, maximum?: number) {
  // Clamp fallback into valid range
  let safeFallback = fallback < minimum ? minimum : fallback
  if (maximum !== undefined && safeFallback > maximum) {
    safeFallback = maximum
  }

  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return safeFallback
  }

  if (maximum !== undefined && parsed > maximum) {
    return safeFallback
  }

  return parsed
}
