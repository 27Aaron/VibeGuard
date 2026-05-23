const DEFAULT_API_URL = "http://127.0.0.1:3000"

const LOCALHOST_PATTERNS = [
  "127.0.0.1",
  "localhost",
  "[::1]",
  "0.0.0.0",
]

function isLocalhost(url: URL): boolean {
  return LOCALHOST_PATTERNS.some(
    (pattern) => url.hostname === pattern || url.hostname.endsWith(".localhost"),
  )
}

function validateApiUrl(raw: string): string {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`Invalid VIBEGUARD_API_URL: "${raw}" is not a valid URL`)
  }

  if (parsed.protocol !== "https:" && !isLocalhost(parsed)) {
    throw new Error(
      `VIBEGUARD_API_URL must use HTTPS for non-localhost connections. Got: ${parsed.protocol}//${parsed.hostname}`,
    )
  }

  return raw.replace(/\/$/, "")
}

export type ArticleListItem = {
  id: string
  title: string
  summary: string
  url: string | null
  sourceName: string
  ecosystem: string
  riskCategory: string
  tags: string[]
  status: string
  publishedAt: string
  publishedAtDisplay: string
  updatedAt: string
  updatedAtDisplay: string
  locale: string
}

export type ArticleListMeta = {
  lang: string
  status: string
  source: string | null
  query: string | null
  ecosystem: string | null
  riskCategory: string | null
  tag: string | null
  limit: number
  count: number
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type ArticleDetail = {
  id: string
  title: string
  summary: string
  content: string
  url: string | null
  canonicalUrl: string | null
  sourceName: string
  ecosystem: string
  riskCategory: string
  tags: string[]
  status: string
  publishedAt: string
  publishedAtDisplay: string
  updatedAt: string
  updatedAtDisplay: string
  locale: string
}

export type PackageFinding = {
  package: { ecosystem: string; name: string; version?: string }
  advisory: { id: string; riskType: string; summary: string }
  affectedPackage: { fixedVersions: string[] }
  affected: boolean
  matchSummary?: string
}

export type SecurityOverviewTotals = {
  npm: number
  pypi: number
  go: number
  "crates-io": number
}

export class VibeGuardClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    const raw = baseUrl || process.env.VIBEGUARD_API_URL || DEFAULT_API_URL
    this.baseUrl = validateApiUrl(raw)
  }

  async searchArticles(params: {
    q?: string
    tag?: string
    ecosystem?: string
    riskCategory?: string
    limit?: number
    lang?: string
  }): Promise<{ meta: ArticleListMeta; items: ArticleListItem[] }> {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set("q", params.q)
    if (params.tag) searchParams.set("tag", params.tag)
    if (params.ecosystem) searchParams.set("ecosystem", params.ecosystem)
    if (params.riskCategory) searchParams.set("riskCategory", params.riskCategory)
    searchParams.set("limit", String(params.limit || 10))
    searchParams.set("lang", params.lang || "zh")

    const res = await fetch(`${this.baseUrl}/api/articles?${searchParams}`, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }

  async getArticle(id: string, lang?: string): Promise<ArticleDetail | null> {
    const searchParams = new URLSearchParams()
    searchParams.set("lang", lang || "zh")

    const res = await fetch(`${this.baseUrl}/api/articles/${id}?${searchParams}`, { signal: AbortSignal.timeout(30_000) })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }

  async checkPackages(packages: Array<{
    ecosystem: string
    name: string
    version?: string
  }>): Promise<{ findings: PackageFinding[] }> {
    const res = await fetch(`${this.baseUrl}/api/security/check/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packages }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }

  async securityOverview(): Promise<{ totals: SecurityOverviewTotals }> {
    const res = await fetch(`${this.baseUrl}/api/security/check/overview`, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }
}
