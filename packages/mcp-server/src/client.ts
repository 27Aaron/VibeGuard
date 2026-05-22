const DEFAULT_API_URL = "http://127.0.0.1:3000"

export class VibeGuardClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || process.env.VIBEGUARD_API_URL || DEFAULT_API_URL).replace(/\/$/, "")
  }

  async searchArticles(params: {
    q?: string
    tag?: string
    ecosystem?: string
    riskCategory?: string
    limit?: number
    lang?: string
  }): Promise<{ meta: any; items: any[] }> {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set("q", params.q)
    if (params.tag) searchParams.set("tag", params.tag)
    if (params.ecosystem) searchParams.set("ecosystem", params.ecosystem)
    if (params.riskCategory) searchParams.set("riskCategory", params.riskCategory)
    searchParams.set("limit", String(params.limit || 10))
    searchParams.set("lang", params.lang || "zh")

    const res = await fetch(`${this.baseUrl}/api/articles?${searchParams}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }

  async getArticle(id: string, lang?: string): Promise<any> {
    const searchParams = new URLSearchParams()
    searchParams.set("lang", lang || "zh")

    const res = await fetch(`${this.baseUrl}/api/articles/${id}?${searchParams}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }

  async checkPackages(packages: Array<{
    ecosystem: string
    name: string
    version?: string
  }>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/security/check/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packages }),
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }

  async securityOverview(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/security/check/overview`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  }
}
