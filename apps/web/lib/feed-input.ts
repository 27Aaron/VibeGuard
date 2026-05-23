const MAX_FEED_NAME_LENGTH = 120
const MAX_POLL_INTERVAL_MINUTES = 1440

export type ParsedFeedInput = {
  name: string
  siteUrl: string
  feedUrl: string
  feedType: "rss" | "atom"
  pollIntervalMinutes: number
  enabled: boolean
}

function coerceFeedType(value: string) {
  return value === "atom" ? "atom" : "rss"
}

function coercePollInterval(value: string) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30
  }

  return Math.min(parsed, MAX_POLL_INTERVAL_MINUTES)
}

function parseUrl(value: string, label: string) {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} 必须是完整的绝对地址。`)
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} 只支持 http 或 https 地址。`)
  }

  return url.toString()
}

export function parseFeedInput(formData: FormData): ParsedFeedInput {
  const name = String(formData.get("name") ?? "").trim()
  const siteUrl = String(formData.get("siteUrl") ?? "").trim()
  const feedUrl = String(formData.get("feedUrl") ?? "").trim()
  const feedType = coerceFeedType(String(formData.get("feedType") ?? "rss"))
  const pollIntervalMinutes = coercePollInterval(
    String(formData.get("pollIntervalMinutes") ?? "30"),
  )
  const enabled = formData.get("enabled") === "on"

  if (!name || !siteUrl || !feedUrl) {
    throw new Error("来源名称、站点地址和订阅地址都必须填写。")
  }

  if (name.length > MAX_FEED_NAME_LENGTH) {
    throw new Error(`来源名称不能超过 ${MAX_FEED_NAME_LENGTH} 个字符。`)
  }

  return {
    name,
    siteUrl: parseUrl(siteUrl, "站点地址"),
    feedUrl: parseUrl(feedUrl, "订阅地址"),
    feedType,
    pollIntervalMinutes,
    enabled,
  }
}
