export function normalizeInt(value: string | undefined, fallback: number, minimum = 1) {
  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}
