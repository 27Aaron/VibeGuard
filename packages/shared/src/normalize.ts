export function normalizeInt(value: string | undefined, fallback: number, minimum = 1, maximum?: number) {
  // 将默认值限制在合法的取值范围内，确保返回值不会越界
  let safeFallback = fallback < minimum ? minimum : fallback
  if (maximum !== undefined && safeFallback > maximum) {
    safeFallback = maximum
  }

  // 对空字符串或 falsy 值提前返回默认值，避免将空字符串传入 parseInt 导致意外结果
  if (!value) {
    return safeFallback
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return safeFallback
  }

  if (maximum !== undefined && parsed > maximum) {
    return safeFallback
  }

  return parsed
}
