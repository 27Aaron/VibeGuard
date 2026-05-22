export function parsePositiveInteger(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.floor(parsed)
}

export function parsePageSize<T extends number>(
  value: string | null | undefined,
  options: readonly T[],
  fallback: T,
): T {
  const parsed = parsePositiveInteger(value, fallback)

  return options.includes(parsed as T) ? (parsed as T) : fallback
}
