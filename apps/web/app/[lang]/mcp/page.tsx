import type { Metadata } from "next";
import { headers } from "next/headers";
import type { LucideIcon } from "lucide-react";
import {
  Braces,
  Database,
  FileText,
  Plug,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { PublicHeader } from "@/components/public-header";
import { CopyButton } from "@/components/ui/copy-button";
import { resolveLang } from "@/lib/i18n";
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens";

import { ConfigCard } from "./config-card";

export const dynamic = "force-dynamic";

async function getMcpEndpoint() {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host =
    hdrs.get("x-forwarded-host") ??
    hdrs.get("host") ??
    "vibeguard.aihot.virxact.com";
  return `${proto}://${host}/api/mcp`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = resolveLang(rawLang);
  const title =
    lang === "zh" ? "MCP Server - VibeGuard" : "MCP Server - VibeGuard";
  const description =
    lang === "zh"
      ? "VibeGuard MCP Server 让 AI 助手直接查询供应链安全资讯和检查依赖包漏洞。"
      : "VibeGuard MCP Server enables AI assistants to query supply-chain security intelligence and check packages for vulnerabilities.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: lang === "zh" ? "zh_CN" : "en_US",
    },
  };
}

type McpPageProps = {
  params: Promise<{ lang: string }>;
};

type McpTool = {
  name: string;
  zh: string;
  en: string;
};

type McpToolGroup = {
  icon: LucideIcon;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  tools: McpTool[];
};

const toolGroups: McpToolGroup[] = [
  {
    icon: FileText,
    titleZh: "内容检索",
    titleEn: "Content",
    summaryZh: "让 AI 助手读到 VibeGuard 已整理好的供应链安全资讯。",
    summaryEn:
      "Let AI assistants read curated VibeGuard supply-chain intelligence.",
    tools: [
      {
        name: "search_articles",
        zh: "搜索供应链安全资讯文章，支持关键词、标签、生态系统、风险类别筛选。",
        en: "Search supply-chain security articles by keyword, tag, ecosystem, or risk category.",
      },
      {
        name: "get_article",
        zh: "获取单篇安全资讯文章的完整详情，包含 Markdown 正文。",
        en: "Get full article details including Markdown body.",
      },
    ],
  },
  {
    icon: ShieldCheck,
    titleZh: "安全查询",
    titleEn: "Security queries",
    summaryZh: "复用公开安全 API，按包、版本、CVE 和风险信号做结构化查询。",
    summaryEn:
      "Reuse the public security API for package, version, CVE, and risk-signal queries.",
    tools: [
      {
        name: "check_packages",
        zh: "批量检查依赖包是否存在已知安全漏洞，支持 npm、pypi、go、crates-io。",
        en: "Batch check packages for known vulnerabilities across npm, pypi, go, crates-io.",
      },
      {
        name: "search_advisories",
        zh: "查询结构化漏洞公告，支持按包、CVE、风险类型、KEV、CVSS、EPSS 筛选。",
        en: "Search structured advisories by package, CVE, risk type, KEV, CVSS, or EPSS.",
      },
      {
        name: "package_profile",
        zh: "获取单个包的风险画像，包含命中数量、确认影响数量、最高风险和推荐修复版本。",
        en: "Get one package profile with finding counts, affected counts, highest risk, and recommended fixes.",
      },
      {
        name: "get_cve",
        zh: "获取 CVE 的 CVSS、EPSS、CISA KEV、CWE 与相关公告。",
        en: "Get CVSS, EPSS, CISA KEV, CWE, and related advisories for one CVE.",
      },
    ],
  },
  {
    icon: Database,
    titleZh: "数据状态",
    titleEn: "Data status",
    summaryZh: "检查本地安全数据库的新鲜度，方便判断查询结果是否需要刷新。",
    summaryEn:
      "Inspect local security-data freshness so results can be refreshed when needed.",
    tools: [
      {
        name: "security_overview",
        zh: "获取 VibeGuard 本地 OSV 数据库各生态系统的漏洞统计概览。",
        en: "Get vulnerability statistics per ecosystem from the local OSV database.",
      },
      {
        name: "security_sync_status",
        zh: "查看 OSV、NVD、EPSS、CISA KEV 等安全数据源同步状态和新鲜度。",
        en: "Check sync status and freshness for OSV, NVD, EPSS, CISA KEV, and other security sources.",
      },
    ],
  },
];

export default async function McpPage({ params: routeParams }: McpPageProps) {
  const { lang: rawLang } = await routeParams;
  const lang = resolveLang(rawLang);
  const mcpUrl = await getMcpEndpoint();

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />

      <div className={getShellClassName()}>
        <PublicHeader
          homeHref={`/${lang}`}
          currentLang={lang}
          currentSurface="mcp"
        />

        <section className={getSectionOuterClassName()}>
          <div className={getSectionInnerClassName()}>
            <div className="flex flex-col gap-8">
              {/* Hero */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-[1.1rem] border border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_2px_8px_rgba(15,23,42,0.08)] dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <Braces className="size-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-stone-100">
                    MCP Server
                  </h1>
                  <p className="mt-2 text-sm text-zinc-600 sm:whitespace-nowrap dark:text-stone-400">
                    {lang === "zh"
                      ? "把 VibeGuard 的文章、安全查询和本地漏洞库状态，直接变成 AI 助手可调用的工具。"
                      : "Turn VibeGuard articles, security queries, and local vulnerability data status into AI-callable tools."}
                  </p>
                </div>
              </div>

              {/* Endpoint */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Plug className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "接入地址" : "Endpoint"}
                </h2>

                <div className="rounded-[1rem] border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="mb-3 text-xs text-zinc-500 dark:text-stone-400">
                    {lang === "zh"
                      ? "Streamable HTTP — 在支持 MCP 的 AI 工具中配置以下地址："
                      : "Streamable HTTP — configure this URL in any MCP-compatible AI tool:"}
                  </p>
                  <div className="flex flex-col gap-2 rounded-xl border border-emerald-900/10 bg-[#f0f7f2] px-4 py-2.5 dark:border-emerald-200/10 dark:bg-emerald-300/8 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      <code className="min-w-0 break-all text-sm font-mono text-emerald-900 dark:text-emerald-100">
                        {mcpUrl}
                      </code>
                    </div>
                    <CopyButton
                      text={mcpUrl}
                      label={lang === "zh" ? "复制" : "Copy"}
                      copiedLabel={lang === "zh" ? "已复制" : "Copied"}
                    />
                  </div>
                </div>
              </div>

              {/* Tools */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Braces className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "可用工具" : "Available Tools"}
                </h2>

                <div className="grid gap-3">
                  {toolGroups.map((group) => {
                    const Icon = group.icon;
                    return (
                      <div
                        key={group.titleEn}
                        className="grid gap-5 rounded-[1rem] border border-black/5 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.035] lg:grid-cols-[minmax(0,16rem)_1fr]"
                      >
                        <div className="flex items-start gap-3 lg:pr-2">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-[0.75rem] border border-emerald-900/10 bg-[#f0f7f2] text-emerald-800 dark:border-emerald-200/10 dark:bg-emerald-300/8 dark:text-emerald-200">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-stone-100">
                              {lang === "zh" ? group.titleZh : group.titleEn}
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-stone-400">
                              {lang === "zh"
                                ? group.summaryZh
                                : group.summaryEn}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-2 xl:grid-cols-2">
                          {group.tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="grid min-h-[4.5rem] content-start gap-2 rounded-[0.85rem] border border-black/5 bg-white/70 px-3.5 py-3 dark:border-white/8 dark:bg-black/10"
                            >
                              <code className="block w-fit max-w-full self-start rounded-md border border-emerald-900/10 bg-[#f0f7f2] px-1.5 py-0.5 text-xs font-mono text-emerald-800 dark:border-emerald-200/10 dark:bg-emerald-300/8 dark:text-emerald-200">
                                {tool.name}
                              </code>
                              <p className="text-sm leading-6 text-zinc-600 dark:text-stone-400">
                                {lang === "zh" ? tool.zh : tool.en}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Config Examples */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Wrench className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "配置示例" : "Configuration"}
                </h2>

                <div className="grid gap-3 sm:grid-cols-3">
                  <ConfigCard
                    title="Claude Code"
                    code={`claude mcp add vibeguard \\\n  --transport http \\\n  ${mcpUrl}`}
                  />
                  <ConfigCard
                    title="Claude Desktop"
                    code={JSON.stringify(
                      {
                        mcpServers: {
                          vibeguard: {
                            type: "url",
                            url: mcpUrl,
                          },
                        },
                      },
                      null,
                      2,
                    )}
                  />
                  <ConfigCard
                    title="Codex"
                    code={JSON.stringify(
                      {
                        mcpServers: {
                          vibeguard: {
                            url: mcpUrl,
                          },
                        },
                      },
                      null,
                      2,
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
