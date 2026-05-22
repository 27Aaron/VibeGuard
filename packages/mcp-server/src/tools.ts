import { z } from "zod"

import type { VibeGuardClient } from "./client"

type ToolHandler = (
  client: VibeGuardClient,
  args: Record<string, unknown>,
) => Promise<string>

interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, z.ZodTypeAny>
  handler: ToolHandler
}

const ecosystems = ["npm", "pypi", "maven", "go", "crates-io", "github-actions", "docker", "multi"] as const
const riskCategories = ["vulnerability", "exploit-activity", "malicious-package", "supply-chain-attack", "dependency-risk"] as const
const checkEcosystems = ["npm", "pypi", "go", "crates-io"] as const

export const tools: ToolDefinition[] = [
  {
    name: "search_articles",
    description: "搜索 VibeGuard 供应链安全资讯文章。支持关键词、标签、生态系统、风险类别筛选。",
    inputSchema: {
      q: z.string().optional().describe("全文搜索关键词"),
      tag: z.string().optional().describe("按标签筛选，如 cve、npm、supply-chain"),
      ecosystem: z.enum(ecosystems).optional().describe("按生态系统筛选"),
      riskCategory: z.enum(riskCategories).optional().describe("按风险类别筛选"),
      limit: z.number().min(1).max(100).optional().describe("返回数量，默认 10，最大 100"),
    },
    async handler(client, args) {
      const result = await client.searchArticles({
        q: args.q as string,
        tag: args.tag as string,
        ecosystem: args.ecosystem as string,
        riskCategory: args.riskCategory as string,
        limit: args.limit as number,
      })

      if (result.items.length === 0) {
        return "未找到匹配的文章。"
      }

      const lines = result.items.map((a: any, i: number) =>
        `${i + 1}. **${a.title}**\n   来源: ${a.sourceName} | 生态: ${a.ecosystem} | 风险: ${a.riskCategory}\n   标签: ${a.tags.join(", ")}\n   发布: ${a.publishedAtDisplay}\n   摘要: ${a.summary}\n   ID: ${a.id}`,
      )

      return `找到 ${result.meta.totalCount} 篇文章（第 ${result.meta.page}/${result.meta.totalPages} 页）:\n\n${lines.join("\n\n")}`
    },
  },
  {
    name: "get_article",
    description: "获取单篇安全资讯文章的完整详情，包含 Markdown 正文。",
    inputSchema: {
      id: z.string().describe("文章 UUID"),
      lang: z.enum(["zh", "en"]).optional().describe("语言 (zh/en)，默认 zh"),
    },
    async handler(client, args) {
      const article = await client.getArticle(args.id as string, args.lang as string)
      if (!article) return "未找到该文章。"

      return [
        `# ${article.title}`,
        "",
        `来源: ${article.sourceName} | 生态: ${article.ecosystem} | 风险: ${article.riskCategory}`,
        `标签: ${article.tags.join(", ")}`,
        `发布: ${article.publishedAtDisplay}`,
        article.url ? `链接: ${article.url}` : "",
        "",
        `## 摘要`,
        article.summary,
        "",
        `## 正文`,
        article.content,
      ].filter(Boolean).join("\n")
    },
  },
  {
    name: "check_packages",
    description: "批量检查依赖包是否存在已知安全漏洞。支持 npm、pypi、go、crates-io 生态。",
    inputSchema: {
      packages: z.array(z.object({
        ecosystem: z.enum(checkEcosystems).describe("包所在生态系统"),
        name: z.string().describe("包名"),
        version: z.string().optional().describe("版本号（可选，不传则查所有版本）"),
      })).min(1).max(100).describe("要检查的包列表"),
    },
    async handler(client, args) {
      const packages = args.packages as Array<{ ecosystem: string; name: string; version?: string }>
      const result = await client.checkPackages(packages)

      if (result.findings.length === 0) {
        return "未发现已知漏洞。"
      }

      const lines = result.findings.map((f: any, i: number) => {
        const pkg = f.package
        const adv = f.advisory
        const fixed = f.affectedPackage.fixedVersions.length > 0
          ? `修复版本: ${f.affectedPackage.fixedVersions.join(", ")}`
          : "暂无修复版本"

        return [
          `${i + 1}. **${pkg.ecosystem}/${pkg.name}${pkg.version ? "@" + pkg.version : ""}** — ${f.affected ? "受影响" : "可能受影响"}`,
          `   公告: ${adv.id} (${adv.riskType})`,
          `   摘要: ${adv.summary}`,
          `   ${fixed}`,
          f.matchSummary ? `   匹配: ${f.matchSummary}` : "",
        ].filter(Boolean).join("\n")
      })

      return `发现 ${result.findings.length} 个漏洞:\n\n${lines.join("\n\n")}`
    },
  },
  {
    name: "security_overview",
    description: "获取 VibeGuard 本地 OSV 数据库各生态系统的漏洞统计概览。",
    inputSchema: {},
    async handler(client) {
      const result = await client.securityOverview()
      const totals = result.totals
      return [
        "OSV 漏洞数据库统计:",
        `- npm: ${totals.npm} 个受影响包`,
        `- pypi: ${totals.pypi} 个受影响包`,
        `- go: ${totals.go} 个受影响包`,
        `- crates-io: ${totals["crates-io"]} 个受影响包`,
      ].join("\n")
    },
  },
]
