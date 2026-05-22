import type { Metadata } from "next"
import { Braces, FileJson, Search } from "lucide-react"

import { PublicHeader } from "@/components/public-header"
import { resolveLang } from "@/lib/i18n"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens"

import { EndpointCard } from "./endpoint-card"

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
                      ? "公开接口无需认证，浏览器直接访问即可。点击参数标签查看详情与示例。"
                      : "Public endpoints require no authentication. Click parameter tags for details and examples."}
                  </p>
                  <a
                    href="/openapi.yaml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                  >
                    <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3.75 2a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V5.56l5.22 5.22a.75.75 0 1 0 1.06-1.06L5.56 4.5h7.69a.75.75 0 0 0 0-1.5H3.75Z" />
                    </svg>
                    OpenAPI
                    <span className="font-mono text-[0.6rem] opacity-60">v3.1</span>
                  </a>
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
                  lang={lang}
                  description={lang === "zh"
                    ? "查询文章列表，支持关键词搜索、标签筛选、来源过滤与分页。"
                    : "Query articles with keyword search, tag filtering, source filtering, and pagination."}
                  params={[
                    {
                      key: "q",
                      label: lang === "zh" ? "关键词" : "keyword",
                      detail: lang === "zh"
                        ? "全文搜索关键词，匹配文章标题和摘要。支持中英文。"
                        : "Full-text search keyword, matches article titles and summaries. Supports both Chinese and English.",
                      examples: [
                        { label: "/api/articles?q=cve", href: "/api/articles?q=cve" },
                        { label: "/api/articles?q=供应链", href: "/api/articles?q=供应链" },
                      ],
                    },
                    {
                      key: "tag",
                      label: lang === "zh" ? "标签" : "tag",
                      detail: lang === "zh"
                        ? "按标签筛选文章。标签由 LLM 自动生成，如 cve、npm、supply-chain 等。"
                        : "Filter by tag. Tags are auto-generated by LLM, e.g. cve, npm, supply-chain.",
                      examples: [
                        { label: "/api/articles?tag=cve", href: "/api/articles?tag=cve" },
                        { label: "/api/articles?tag=npm", href: "/api/articles?tag=npm" },
                      ],
                    },
                    {
                      key: "source",
                      label: lang === "zh" ? "来源" : "source",
                      detail: lang === "zh"
                        ? "按内容来源筛选。来源名称对应 RSS 订阅源的名称。"
                        : "Filter by content source. Source name corresponds to the RSS feed name.",
                      examples: [
                        { label: "/api/articles?source=GitHub Advisory", href: "/api/articles?source=GitHub Advisory" },
                      ],
                    },
                    {
                      key: "ecosystem",
                      label: lang === "zh" ? "生态系统" : "ecosystem",
                      detail: lang === "zh"
                        ? "按包管理生态系统筛选。可选值：npm、pypi、go、crates-io、maven、docker、github-actions。"
                        : "Filter by package ecosystem. Values: npm, pypi, go, crates-io, maven, docker, github-actions.",
                      examples: [
                        { label: "/api/articles?ecosystem=npm", href: "/api/articles?ecosystem=npm" },
                        { label: "/api/articles?ecosystem=pypi", href: "/api/articles?ecosystem=pypi" },
                      ],
                    },
                    {
                      key: "riskCategory",
                      label: lang === "zh" ? "风险类别" : "risk category",
                      detail: lang === "zh"
                        ? "按风险类型筛选。可选值：vulnerability（漏洞）、exploit-activity（利用活动）、malicious-package（恶意包）、supply-chain-attack（供应链攻击）、dependency-risk（依赖风险）。"
                        : "Filter by risk type. Values: vulnerability, exploit-activity, malicious-package, supply-chain-attack, dependency-risk.",
                      examples: [
                        { label: "/api/articles?riskCategory=vulnerability", href: "/api/articles?riskCategory=vulnerability" },
                        { label: "/api/articles?riskCategory=malicious-package", href: "/api/articles?riskCategory=malicious-package" },
                      ],
                    },
                    {
                      key: "limit",
                      label: lang === "zh" ? "每页数量" : "page size",
                      detail: lang === "zh"
                        ? "每页返回的文章数量，范围 1-100，默认 20。"
                        : "Number of articles per page, range 1-100, default 20.",
                      examples: [
                        { label: "/api/articles?limit=5", href: "/api/articles?limit=5" },
                        { label: "/api/articles?limit=100", href: "/api/articles?limit=100" },
                      ],
                    },
                    {
                      key: "page",
                      label: lang === "zh" ? "页码" : "page number",
                      detail: lang === "zh"
                        ? "分页页码，从 1 开始。配合 limit 使用。"
                        : "Page number, starting from 1. Use with limit.",
                      examples: [
                        { label: "/api/articles?limit=10&page=2", href: "/api/articles?limit=10&page=2" },
                      ],
                    },
                    {
                      key: "lang",
                      label: lang === "zh" ? "语言" : "language",
                      detail: lang === "zh"
                        ? "返回内容的语言。zh 返回中文标题和摘要，en 返回英文。默认跟随站点语言。"
                        : "Language of returned content. zh for Chinese title/summary, en for English. Defaults to site language.",
                      examples: [
                        { label: "/api/articles?lang=en&limit=3", href: "/api/articles?lang=en&limit=3" },
                      ],
                    },
                  ]}
                />

                <EndpointCard
                  method="GET"
                  path="/api/articles/{id}"
                  lang={lang}
                  description={lang === "zh"
                    ? "根据文章 ID 获取完整详情，包含 Markdown 正文、元数据、标签等。"
                    : "Get full article details by ID, including Markdown body, metadata, and tags."}
                  params={[
                    {
                      key: "id",
                      label: lang === "zh" ? "文章 ID" : "article ID",
                      detail: lang === "zh"
                        ? "UUID 格式的文章唯一标识符。可通过 /api/articles 列表接口获取。"
                        : "UUID-format article unique identifier. Obtainable from the /api/articles list endpoint.",
                      examples: [
                        { label: "/api/articles?limit=1", href: "/api/articles?limit=1" },
                      ],
                    },
                    {
                      key: "lang",
                      label: lang === "zh" ? "语言" : "language",
                      detail: lang === "zh"
                        ? "返回内容的语言。zh 返回中文标题、摘要和正文，en 返回英文版本。不传则根据站点语言自动选择。"
                        : "Language of returned content. zh for Chinese, en for English. Defaults to site language.",
                      examples: [
                        { label: "/api/articles/{id}?lang=zh", href: "#" },
                        { label: "/api/articles/{id}?lang=en", href: "#" },
                      ],
                    },
                    {
                      key: "response",
                      label: lang === "zh" ? "返回字段" : "response fields",
                      detail: lang === "zh"
                        ? "返回完整文章对象：title、summary、content（Markdown）、sourceName、ecosystem、riskCategory、tags、publishedAt 等。"
                        : "Returns full article object: title, summary, content (Markdown), sourceName, ecosystem, riskCategory, tags, publishedAt, etc.",
                    },
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
                  lang={lang}
                  description={lang === "zh"
                    ? "返回本地 OSV 数据库各生态系统的漏洞公告数量统计。"
                    : "Returns vulnerability advisory counts per ecosystem from the local OSV database."}
                  params={[
                    {
                      key: "response",
                      label: lang === "zh" ? "返回格式" : "response",
                      detail: lang === "zh"
                        ? "返回 JSON 对象，包含 npm、pypi、go、crates-io 四个生态的受影响包数量。"
                        : "Returns a JSON object with affected package counts for npm, pypi, go, and crates-io ecosystems.",
                      examples: [
                        { label: "/api/security/check/overview", href: "/api/security/check/overview" },
                      ],
                    },
                  ]}
                />

                <EndpointCard
                  method="POST"
                  path="/api/security/check/packages"
                  lang={lang}
                  description={lang === "zh"
                    ? "批量检查依赖包是否存在已知安全漏洞。支持 npm、pypi、go、crates-io 生态，单次最多 100 个包。"
                    : "Batch check packages for known vulnerabilities. Supports npm, pypi, go, crates-io ecosystems, max 100 packages per request."}
                  params={[
                    {
                      key: "ecosystem",
                      label: lang === "zh" ? "生态系统" : "ecosystem",
                      detail: lang === "zh"
                        ? "包所在的生态系统。可选值：npm、pypi、go、crates-io。"
                        : "Package ecosystem. Values: npm, pypi, go, crates-io.",
                      examples: [
                        { label: '{ "ecosystem": "npm", ... }', href: "#" },
                        { label: '{ "ecosystem": "pypi", ... }', href: "#" },
                      ],
                    },
                    {
                      key: "name",
                      label: lang === "zh" ? "包名" : "package name",
                      detail: lang === "zh"
                        ? "依赖包名称。npm 包如 lodash，pypi 包如 requests，Go 包用完整模块路径。"
                        : "Package name. e.g. lodash (npm), requests (pypi), full module path for Go.",
                      examples: [
                        { label: '{ "name": "lodash" }', href: "#" },
                        { label: '{ "name": "github.com/gin-gonic/gin" }', href: "#" },
                      ],
                    },
                    {
                      key: "version",
                      label: lang === "zh" ? "版本（可选）" : "version (optional)",
                      detail: lang === "zh"
                        ? "指定版本号精确匹配。不传则返回该包所有已知漏洞。"
                        : "Exact version match. Omit to return all known vulnerabilities for the package.",
                      examples: [
                        { label: '{ "version": "4.17.20" }', href: "#" },
                      ],
                    },
                    {
                      key: "body",
                      label: lang === "zh" ? "完整请求体" : "full body",
                      detail: lang === "zh"
                        ? "POST 请求体为 JSON 格式，packages 数组包含 1-100 个包坐标。"
                        : "POST body is JSON. The packages array contains 1-100 package coordinates.",
                      examples: [
                        {
                          label: '{ "packages": [{ "ecosystem": "npm", "name": "lodash", "version": "4.17.20" }, ...] }',
                          href: "#",
                        },
                      ],
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
