import { z } from "zod";

import {
  MCP_CHECK_ECOSYSTEMS,
  MCP_ECOSYSTEMS,
  MCP_RISK_CATEGORIES,
} from "@vibeguard/shared";
import type { VibeGuardClient } from "./client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CVE_RE = /^CVE-\d{4}-\d{4,}$/i;

function assertUuid(value: string, label = "id"): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}: must be a valid UUID`);
  }
}

function assertCve(value: string): void {
  if (!CVE_RE.test(value)) {
    throw new Error("Invalid CVE: must look like CVE-2026-12345");
  }
}

type ToolHandler<
  T extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>,
> = (client: VibeGuardClient, args: z.infer<z.ZodObject<T>>) => Promise<string>;

interface ToolDefinition<
  T extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>,
> {
  name: string;
  description: string;
  inputSchema: T;
  handler: ToolHandler<T>;
}

export const tools: ToolDefinition[] = [
  {
    name: "search_articles",
    description:
      "搜索 VibeGuard 供应链安全资讯文章。支持关键词、标签、生态系统、风险类别筛选。",
    inputSchema: {
      q: z.string().optional().describe("全文搜索关键词"),
      tag: z
        .string()
        .optional()
        .describe("按标签筛选，如 cve、npm、supply-chain"),
      ecosystem: z.enum(MCP_ECOSYSTEMS).optional().describe("按生态系统筛选"),
      riskCategory: z
        .enum(MCP_RISK_CATEGORIES)
        .optional()
        .describe("按风险类别筛选"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("返回数量，默认 10，最大 100"),
      lang: z.enum(["zh", "en"]).optional().describe("语言 (zh/en)，默认 zh"),
    },
    async handler(client, args) {
      const result = await client.searchArticles({
        q: args.q as string | undefined,
        tag: args.tag as string | undefined,
        ecosystem: args.ecosystem as string | undefined,
        riskCategory: args.riskCategory as string | undefined,
        limit: args.limit as number | undefined,
        lang: args.lang as string | undefined,
      });

      if (result.items.length === 0) {
        return "未找到匹配的文章。";
      }

      const lines = result.items.map(
        (a, i: number) =>
          `${i + 1}. **${a.title}**\n   来源: ${a.sourceName} | 生态: ${a.ecosystem} | 风险: ${a.riskCategory}\n   标签: ${a.tags.join(", ")}\n   发布: ${a.publishedAtDisplay}\n   摘要: ${a.summary}\n   ID: ${a.id}`,
      );

      return `找到 ${result.meta.totalCount} 篇文章（第 ${result.meta.page}/${result.meta.totalPages} 页）:\n\n${lines.join("\n\n")}`;
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
      assertUuid(args.id as string, "文章 ID");
      const article = await client.getArticle(
        args.id as string,
        args.lang as string,
      );
      if (!article) return "未找到该文章。";

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
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  {
    name: "check_packages",
    description:
      "批量检查依赖包是否存在已知安全漏洞。支持 npm、pypi、go、crates-io 生态。",
    inputSchema: {
      packages: z
        .array(
          z.object({
            ecosystem: z.enum(MCP_CHECK_ECOSYSTEMS).describe("包所在生态系统"),
            name: z.string().describe("包名"),
            version: z
              .string()
              .optional()
              .describe("版本号（可选，不传则查所有版本）"),
          }),
        )
        .min(1)
        .max(100)
        .describe("要检查的包列表"),
    },
    async handler(client, args) {
      const packages = args.packages as Array<{
        ecosystem: string;
        name: string;
        version?: string;
      }>;
      const result = await client.checkPackages(packages);

      if (result.findings.length === 0) {
        return "未发现已知漏洞。";
      }

      const lines = result.findings.map((f, i: number) => {
        const pkg = f.package;
        const adv = f.advisory;
        const fixed =
          f.affectedPackage.fixedVersions.length > 0
            ? `修复版本: ${f.affectedPackage.fixedVersions.join(", ")}`
            : "暂无修复版本";
        const risk = f.risk ? `风险: ${f.risk.level} (${f.risk.score})` : "";
        const cves = f.cveEnrichments?.length
          ? `CVE: ${f.cveEnrichments.map((cve) => cve.cveId).join(", ")}`
          : "";

        return [
          `${i + 1}. **${pkg.ecosystem}/${pkg.name}${pkg.version ? "@" + pkg.version : ""}** — ${f.affected ? "受影响" : "可能受影响"}`,
          `   公告: ${adv.id} (${adv.riskType})`,
          risk ? `   ${risk}` : "",
          cves ? `   ${cves}` : "",
          `   摘要: ${adv.summary}`,
          `   ${fixed}`,
          f.matchSummary ? `   匹配: ${f.matchSummary}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      });

      return `发现 ${result.findings.length} 个漏洞:\n\n${lines.join("\n\n")}`;
    },
  },
  {
    name: "search_advisories",
    description:
      "查询结构化漏洞公告。支持按包、CVE、风险类型、KEV、CVSS、EPSS 筛选。",
    inputSchema: {
      q: z.string().optional().describe("搜索 GHSA、MAL、摘要、详情或关联 ID"),
      ecosystem: z.enum(MCP_CHECK_ECOSYSTEMS).optional().describe("包生态系统"),
      packageName: z.string().optional().describe("包名；配合 ecosystem 使用"),
      cve: z.string().optional().describe("CVE 编号，如 CVE-2026-25639"),
      riskType: z
        .enum(["unknown", "vulnerability", "malicious-package"])
        .optional()
        .describe("风险类型"),
      kev: z.boolean().optional().describe("是否筛选 CISA KEV 记录"),
      cvssMin: z.number().min(0).max(10).optional().describe("最低 CVSS 分数"),
      epssMin: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("最低 EPSS percentile"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("返回数量，默认 10"),
    },
    async handler(client, args) {
      if (args.cve) assertCve(args.cve as string);
      const result = await client.searchAdvisories({
        q: args.q as string | undefined,
        ecosystem: args.ecosystem as string | undefined,
        packageName: args.packageName as string | undefined,
        cve: args.cve as string | undefined,
        riskType: args.riskType as string | undefined,
        kev: args.kev as boolean | undefined,
        cvssMin: args.cvssMin as number | undefined,
        epssMin: args.epssMin as number | undefined,
        limit: args.limit as number | undefined,
      });

      if (result.items.length === 0) {
        return "未找到匹配的漏洞公告。";
      }

      const lines = result.items.map((advisory, index: number) => {
        const cves = advisory.aliases.filter((alias) =>
          alias.startsWith("CVE-"),
        );
        const packages = advisory.packageImpacts
          ?.slice(0, 3)
          .map((impact) => `${impact.ecosystem}/${impact.packageName}`)
          .join(", ");

        return [
          `${index + 1}. **${advisory.id}** (${advisory.riskType})`,
          `   摘要: ${advisory.summary}`,
          cves.length > 0 ? `   CVE: ${cves.join(", ")}` : "",
          packages ? `   影响包: ${packages}` : "",
          advisory.modifiedAt ? `   更新: ${advisory.modifiedAt}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      });

      return `找到 ${result.meta.totalCount} 条漏洞公告（第 ${result.meta.page}/${result.meta.totalPages} 页）:\n\n${lines.join("\n\n")}`;
    },
  },
  {
    name: "package_profile",
    description:
      "获取单个包的风险画像，包含命中数量、确认影响数量、最高风险和推荐修复版本。",
    inputSchema: {
      ecosystem: z.enum(MCP_CHECK_ECOSYSTEMS).describe("包生态系统"),
      name: z.string().describe("包名或 Go module path"),
      version: z.string().optional().describe("可选版本号"),
    },
    async handler(client, args) {
      const result = await client.getPackageProfile(
        args.ecosystem as string,
        args.name as string,
        args.version as string | undefined,
      );
      const summary = result.summary;
      const fixed =
        summary.recommendedFixedVersions.length > 0
          ? summary.recommendedFixedVersions.join(", ")
          : "暂无";
      const highestRisk = summary.highestRisk
        ? `${summary.highestRisk.level} (${summary.highestRisk.score})`
        : "unknown";

      return [
        `包: ${result.package.ecosystem}/${result.package.name}${result.package.version ? `@${result.package.version}` : ""}`,
        `风险记录: ${summary.totalFindings}`,
        `确认命中: ${summary.affectedCount}`,
        `待确认: ${summary.inconclusiveCount}`,
        `最高风险: ${highestRisk}`,
        `建议修复版本: ${fixed}`,
        summary.latestUpdatedAt ? `最近更新: ${summary.latestUpdatedAt}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  {
    name: "get_cve",
    description: "获取 CVE 的 CVSS、EPSS、CISA KEV、CWE 与相关公告。",
    inputSchema: {
      cveId: z.string().describe("CVE 编号，如 CVE-2026-25639"),
    },
    async handler(client, args) {
      assertCve(args.cveId as string);
      const result = await client.getCve(args.cveId as string);
      if (!result) return "未找到该 CVE。";

      const enrichment = result.enrichment;
      return [
        `CVE: ${result.cveId}`,
        enrichment?.bestCvssScore
          ? `CVSS: ${enrichment.bestCvssSeverity ?? "UNKNOWN"} ${enrichment.bestCvssScore}`
          : "",
        enrichment?.epssPercentile
          ? `EPSS percentile: ${enrichment.epssPercentile}`
          : "",
        enrichment?.kevListed ? "CISA KEV: yes" : "CISA KEV: no",
        enrichment?.cweIds?.length
          ? `CWE: ${enrichment.cweIds.join(", ")}`
          : "",
        enrichment?.kevRequiredAction
          ? `KEV 要求: ${enrichment.kevRequiredAction}`
          : "",
        `相关公告: ${result.advisories.map((advisory) => advisory.id).join(", ") || "无"}`,
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  {
    name: "security_overview",
    description: "获取 VibeGuard 本地 OSV 数据库各生态系统的漏洞统计概览。",
    inputSchema: {},
    async handler(client) {
      const result = await client.securityOverview();
      const totals = result.totals;
      return [
        "OSV 漏洞数据库统计:",
        `- npm: ${totals.npm} 个受影响包`,
        `- pypi: ${totals.pypi} 个受影响包`,
        `- go: ${totals.go} 个受影响包`,
        `- crates-io: ${totals["crates-io"]} 个受影响包`,
      ].join("\n");
    },
  },
  {
    name: "security_sync_status",
    description: "查看 OSV、NVD、EPSS、CISA KEV 等安全数据源同步状态和新鲜度。",
    inputSchema: {},
    async handler(client) {
      const result = await client.securitySyncStatus();
      const lines = result.items.map(
        (item) =>
          `- ${item.source}/${item.scope}: ${item.status}, imported=${item.recordsImported}, failed=${item.recordsFailed}, stale=${item.stale}${item.lastSuccessAt ? `, last=${item.lastSuccessAt}` : ""}`,
      );

      return [
        `安全数据源: ${result.meta.sourceCount} 个`,
        `过期阈值: ${Math.round(result.meta.staleAfterMs / 60_000)} 分钟`,
        ...lines,
      ].join("\n");
    },
  },
];
