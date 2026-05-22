import type { Metadata } from "next"
import { headers } from "next/headers"
import { Braces, Plug, Wrench } from "lucide-react"

import { PublicHeader } from "@/components/public-header"
import { resolveLang } from "@/lib/i18n"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens"

import { ConfigCard } from "./config-card"

export const dynamic = "force-dynamic"

async function getMcpEndpoint() {
  const hdrs = await headers()
  const proto = hdrs.get("x-forwarded-proto") ?? "https"
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "vibeguard.aihot.virxact.com"
  return `${proto}://${host}/api/mcp`
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params
  const lang = resolveLang(rawLang)
  const title = lang === "zh" ? "MCP Server - VibeGuard" : "MCP Server - VibeGuard"
  const description = lang === "zh"
    ? "VibeGuard MCP Server 让 AI 助手直接查询供应链安全资讯和检查依赖包漏洞。"
    : "VibeGuard MCP Server enables AI assistants to query supply-chain security intelligence and check packages for vulnerabilities."

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: lang === "zh" ? "zh_CN" : "en_US",
    },
  }
}

type McpPageProps = {
  params: Promise<{ lang: string }>
}

const tools = [
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
  {
    name: "check_packages",
    zh: "批量检查依赖包是否存在已知安全漏洞，支持 npm、pypi、go、crates-io。",
    en: "Batch check packages for known vulnerabilities across npm, pypi, go, crates-io.",
  },
  {
    name: "security_overview",
    zh: "获取各生态系统的漏洞统计概览。",
    en: "Get vulnerability statistics overview per ecosystem.",
  },
]

export default async function McpPage({ params: routeParams }: McpPageProps) {
  const { lang: rawLang } = await routeParams
  const lang = resolveLang(rawLang)
  const nextLang = lang === "zh" ? "en" : "zh"
  const mcpUrl = await getMcpEndpoint()

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />

      <div className={getShellClassName()}>
        <PublicHeader
          homeHref={`/${lang}`}
          nextLangHref={`/${nextLang}/mcp`}
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
                      ? "通过 MCP (Model Context Protocol) 让 AI 助手直接查询供应链安全情报，检查依赖包漏洞。"
                      : "Let AI assistants query supply-chain security intelligence and check package vulnerabilities via MCP (Model Context Protocol)."}
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
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-900/10 bg-[#f0f7f2] px-4 py-2.5 dark:border-emerald-200/10 dark:bg-emerald-300/8">
                    <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    <code className="min-w-0 text-sm font-mono text-emerald-900 dark:text-emerald-100">{mcpUrl}</code>
                  </div>
                </div>
              </div>

              {/* Tools */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Braces className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "可用工具" : "Available Tools"}
                </h2>

                <div className="grid gap-2">
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-start gap-3 rounded-[0.85rem] border border-black/5 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
                    >
                      <code className="mt-0.5 shrink-0 rounded-md border border-emerald-900/10 bg-[#f0f7f2] px-1.5 py-0.5 text-xs font-mono text-emerald-800 dark:border-emerald-200/10 dark:bg-emerald-300/8 dark:text-emerald-200">
                        {tool.name}
                      </code>
                      <p className="text-sm leading-relaxed text-zinc-600 dark:text-stone-400">
                        {lang === "zh" ? tool.zh : tool.en}
                      </p>
                    </div>
                  ))}
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
                    code={JSON.stringify({
                      mcpServers: {
                        vibeguard: {
                          type: "url",
                          url: mcpUrl,
                        },
                      },
                    }, null, 2)}
                  />
                  <ConfigCard
                    title="Codex"
                    code={JSON.stringify({
                      mcpServers: {
                        vibeguard: {
                          url: mcpUrl,
                        },
                      },
                    }, null, 2)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
