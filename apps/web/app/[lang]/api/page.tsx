import type { Metadata } from "next"
import { Braces, FileJson, Rss, Search } from "lucide-react"

import { PublicHeader } from "@/components/public-header"
import { Badge } from "@/components/ui/badge"
import { resolveLang } from "@/lib/i18n"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params
  const lang = resolveLang(rawLang)
  const title = lang === "zh" ? "API 文档 - VibeGuard" : "API Reference - VibeGuard"
  const description = lang === "zh"
    ? "VibeGuard 供应链安全情报公开 API 接口文档，支持文章查询、来源列表与安全检查。"
    : "VibeGuard public API reference for supply-chain security intelligence — articles, sources, and security checks."

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

type ApiPageProps = {
  params: Promise<{ lang: string }>
}

export default async function ApiPage({ params: routeParams }: ApiPageProps) {
  const { lang: rawLang } = await routeParams
  const lang = resolveLang(rawLang)
  const nextLang = lang === "zh" ? "en" : "zh"

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />

      <div className={getShellClassName()}>
        <PublicHeader
          homeHref={`/${lang}`}
          nextLangHref={`/${nextLang}/api`}
          currentLang={lang}
          currentSurface="api"
        />

        <section className={getSectionOuterClassName()}>
          <div className={getSectionInnerClassName()}>
            <div className="flex flex-col gap-8">
              {/* Hero */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-[1.1rem] border border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_2px_8px_rgba(15,23,42,0.08)] dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <FileJson className="size-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-stone-100">
                    {lang === "zh" ? "API 文档" : "API Reference"}
                  </h1>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600 dark:text-stone-400">
                    {lang === "zh"
                      ? "所有接口均为只读 GET 请求，无需认证，浏览器直接访问即可。"
                      : "All endpoints are read-only GET requests. No authentication required — just open in your browser."}
                  </p>
                </div>
              </div>

              {/* Articles */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Braces className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "文章" : "Articles"}
                </h2>

                <EndpointCard
                  method="GET"
                  path="/api/articles"
                  description={lang === "zh"
                    ? "查询文章列表，支持关键词搜索、标签筛选、来源过滤与分页。"
                    : "Query articles with keyword search, tag filtering, source filtering, and pagination."}
                  params={[
                    { key: "q", desc: lang === "zh" ? "关键词" : "keyword" },
                    { key: "tag", desc: lang === "zh" ? "标签" : "tag" },
                    { key: "source", desc: lang === "zh" ? "来源" : "source" },
                    { key: "ecosystem", desc: lang === "zh" ? "生态 (npm/pypi/go/crates-io)" : "ecosystem (npm/pypi/go/crates-io)" },
                    { key: "riskCategory", desc: lang === "zh" ? "风险类别" : "risk category" },
                    { key: "limit", desc: lang === "zh" ? "每页数量 (1-100, 默认 20)" : "page size (1-100, default 20)" },
                    { key: "page", desc: lang === "zh" ? "页码" : "page number" },
                    { key: "lang", desc: lang === "zh" ? "语言 (zh/en)" : "language (zh/en)" },
                  ]}
                  examples={[
                    { label: "/api/articles?limit=5", href: "/api/articles?limit=5" },
                    { label: "/api/articles?q=安全&tag=cve", href: "/api/articles?q=安全&tag=cve" },
                    { label: "/api/articles?source=npm&lang=en", href: "/api/articles?source=npm&lang=en" },
                  ]}
                />

                <EndpointCard
                  method="GET"
                  path="/api/articles/{id}"
                  description={lang === "zh"
                    ? "获取单篇文章详情。"
                    : "Get a single article by ID."}
                  params={[
                    { key: "lang", desc: lang === "zh" ? "语言 (zh/en)" : "language (zh/en)" },
                  ]}
                />
              </div>

              {/* Sources & Overview */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Rss className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "来源与概览" : "Sources & Overview"}
                </h2>

                <EndpointCard
                  method="GET"
                  path="/api/sources"
                  description={lang === "zh"
                    ? "返回所有已启用的内容来源及其文章数量。"
                    : "Returns all enabled content sources with article counts."}
                  examples={[
                    { label: "/api/sources", href: "/api/sources" },
                  ]}
                />

                <EndpointCard
                  method="GET"
                  path="/api/overview"
                  description={lang === "zh"
                    ? "返回文章总数与来源总数概览。"
                    : "Returns total article and source counts."}
                  examples={[
                    { label: "/api/overview", href: "/api/overview" },
                  ]}
                />
              </div>

              {/* Security */}
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-stone-100">
                  <Search className="size-4 text-emerald-700 dark:text-emerald-300" />
                  {lang === "zh" ? "安全检查" : "Security Check"}
                </h2>

                <EndpointCard
                  method="GET"
                  path="/api/security/check/overview"
                  description={lang === "zh"
                    ? "返回本地 OSV 数据库的漏洞统计概览。"
                    : "Returns vulnerability statistics from the local OSV database."}
                  examples={[
                    { label: "/api/security/check/overview", href: "/api/security/check/overview" },
                  ]}
                />

                <EndpointCard
                  method="POST"
                  path="/api/security/check/packages"
                  description={lang === "zh"
                    ? "检查指定依赖包是否存在已知安全漏洞。需 JSON Body。"
                    : "Check packages for known vulnerabilities. Requires JSON body."}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function EndpointCard({
  method,
  path,
  description,
  params,
  examples,
}: {
  method: "GET" | "POST"
  path: string
  description: string
  params?: Array<{ key: string; desc: string }>
  examples?: Array<{ label: string; href: string }>
}) {
  return (
    <div className="rounded-[1.4rem] border border-black/5 bg-white/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="flex items-center gap-2.5 mb-2">
        <Badge
          variant="secondary"
          className={
            method === "GET"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
          }
        >
          {method}
        </Badge>
        <span className="font-mono text-sm font-semibold text-zinc-950 dark:text-stone-100">{path}</span>
      </div>

      <p className="text-xs leading-relaxed text-zinc-600 dark:text-stone-400 mb-3">
        {description}
      </p>

      {params && params.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {params.map((p) => (
            <span
              key={p.key}
              className="inline-flex items-center gap-1 rounded-full border border-black/6 bg-[#f7f7f5] px-2.5 py-0.5 text-[0.65rem] dark:border-white/8 dark:bg-white/[0.04]"
            >
              <span className="font-mono font-semibold text-zinc-800 dark:text-stone-200">{p.key}</span>
              <span className="text-zinc-500 dark:text-stone-400">{p.desc}</span>
            </span>
          ))}
        </div>
      )}

      {examples && examples.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {examples.map((ex) => (
            <a
              key={ex.href}
              href={ex.href}
              className="font-mono text-[0.72rem] text-emerald-800 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200 transition-colors"
            >
              {ex.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
