import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Braces,
  CalendarClock,
  ChevronLeft,
  ExternalLink,
  FileJson,
  FileText,
  Link2,
  Radio,
  Rss,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { MarkdownRenderer, MarkdownSummary } from "@/components/content/markdown-renderer"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getArticleById } from "@/lib/api-articles"
import { getPublicArticleSummaryContainerClass } from "@/lib/article-layout"
import { getArticleStatusLabel } from "@/lib/content-labels"
import { getInteractiveChipClassName } from "@/lib/interactive-chip"
import { getUiText, resolveLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type PublicArticlePageProps = {
  params: Promise<{ articleId: string }>
  searchParams: Promise<{
    lang?: string
    q?: string
    tag?: string
    page?: string
  }>
}

const futureSurfaceLinks: Array<{
  label: string
  icon: LucideIcon
  active?: boolean
  href?: string
}> = [
  { label: "API", icon: FileJson },
  { label: "MCP", icon: Braces },
  { label: "RSS", icon: Rss, active: true, href: "/rss.xml" },
  { label: "Skill", icon: ShieldCheck },
]

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/6 bg-white/72 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.055]">
      {children}
    </span>
  )
}

export default async function PublicArticlePage({
  params,
  searchParams,
}: PublicArticlePageProps) {
  const { articleId } = await params
  const { lang, q, tag, page } = await searchParams
  const resolvedLang = resolveLang(lang)
  const text = getUiText(resolvedLang)
  const article = await getArticleById(articleId, resolvedLang)

  if (!article) {
    notFound()
  }

  const resolvedArticle = article
  const articleLang = resolveLang(resolvedArticle.locale)
  const nextLang = articleLang === "zh" ? "en" : "zh"

  const backParams = new URLSearchParams()
  backParams.set("lang", resolvedArticle.locale)
  if (q) {
    backParams.set("q", q)
  }
  if (tag) {
    backParams.set("tag", tag)
  }
  if (page && page !== "1") {
    backParams.set("page", page)
  }

  function buildArticleHref(nextLang: "zh" | "en") {
    const params = new URLSearchParams(backParams)
    params.set("lang", nextLang)
    return `/articles/${resolvedArticle.id}?${params.toString()}`
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#f2f2f0] text-zinc-950 [background-image:linear-gradient(135deg,rgba(31,77,63,0.10),transparent_34%),linear-gradient(180deg,#faf9f3_0%,#f1f1ed_48%,#e7ece9_100%)] dark:bg-[#070b0f] dark:text-stone-100 dark:[background-image:linear-gradient(135deg,rgba(74,124,104,0.18),transparent_34%),linear-gradient(180deg,#070b0f_0%,#0e151a_52%,#111820_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-[0.13] dark:[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]" />

      <div className="relative mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-40">
          <div className="w-full min-w-0 rounded-[2rem] border border-black/5 bg-white/45 p-1.5 shadow-[0_20px_55px_-34px_rgba(10,10,10,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl md:rounded-full dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_22px_60px_-36px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="grid min-w-0 gap-3 rounded-[1.55rem] bg-white/58 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:rounded-full md:py-2 dark:bg-[#0c1218]/70">
              <Link
                href={`/?${backParams.toString()}`}
                className="flex min-w-0 items-center gap-3 rounded-full pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.06)] dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <ShieldCheck className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-normal">
                    VibeGuard
                  </span>
                  <span className="flex items-center gap-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-stone-400">
                    <Radio className="size-3 text-emerald-700 dark:text-emerald-300" />
                    Live feed
                  </span>
                </span>
              </Link>

              <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center md:justify-self-center">
                {futureSurfaceLinks.map((item) => {
                  const Icon = item.icon
                  const className =
                    "inline-flex h-8 min-w-0 items-center rounded-full border border-black/8 bg-[#eef2f7] p-[2px] text-xs font-semibold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow,color] duration-200 hover:bg-[#e7ecf4] hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white"
                  const surfaceClassName = cn(
                    className,
                    item.active &&
                      "border-emerald-900/18 bg-[#dfe9e2] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_1px_2px_rgba(15,23,42,0.08)] hover:bg-[#d6e4da] hover:text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#16221c] dark:hover:text-emerald-50",
                  )
                  const contentClassName = cn(
                    "inline-flex h-[26px] items-center gap-1.5 rounded-full border border-black/8 bg-white px-2.5 text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.14),0_4px_10px_rgba(15,23,42,0.12)] transition-[background-color,color,border-color,box-shadow] duration-200 dark:border-white/10 dark:bg-[#0c1218] dark:text-stone-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_6px_16px_rgba(0,0,0,0.28)]",
                    item.active &&
                      "border-emerald-900/12 bg-[#f7fbf8] text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.10),0_5px_12px_rgba(20,83,45,0.10)] dark:border-emerald-200/12 dark:bg-[#18241e] dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_16px_rgba(0,0,0,0.26)]",
                  )
                  const iconClassName = cn(
                    "size-[14px]",
                    item.active && "text-emerald-800 dark:text-emerald-300",
                  )

                  if (item.href) {
                    return (
                      <Link key={item.label} href={item.href} className={surfaceClassName}>
                        <span className={contentClassName}>
                          <Icon className={iconClassName} strokeWidth={2} />
                          {item.label}
                        </span>
                      </Link>
                    )
                  }

                  return (
                    <button
                      key={item.label}
                      type="button"
                      aria-disabled="true"
                      title={item.label}
                      className={cn(surfaceClassName, "cursor-default opacity-80")}
                    >
                      <span className={contentClassName}>
                        <Icon className={iconClassName} strokeWidth={2} />
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-end gap-1.5 md:justify-self-end">
                <ThemeToggle />
                <LanguageToggle
                  href={buildArticleHref(nextLang)}
                  currentLang={articleLang}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className="min-w-0 rounded-[2rem] border border-black/5 bg-white/48 p-1.5 shadow-[0_26px_70px_-45px_rgba(10,10,10,0.46),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="min-w-0 rounded-[1.55rem] bg-[#fcfcfa]/92 p-5 shadow-[inset_0_0_0_1px_rgba(10,10,10,0.04),inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-7 dark:bg-[#10161d]/88 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
                  <MetaPill>
                    <span className="size-1.5 rounded-full bg-emerald-700 shadow-[0_0_0_5px_rgba(4,120,87,0.12)] dark:bg-emerald-300 dark:shadow-[0_0_0_5px_rgba(110,231,183,0.12)]" />
                    {getArticleStatusLabel(resolvedArticle.status, resolvedLang)}
                  </MetaPill>
                  <MetaPill>{resolvedArticle.sourceName}</MetaPill>
                  <MetaPill>
                    <CalendarClock className="size-3.5" />
                    {resolvedArticle.publishedAtDisplay}
                  </MetaPill>
                </div>

                <div className="mt-6 max-w-5xl">
                  <h1 className="max-w-6xl text-3xl font-semibold leading-tight tracking-normal text-zinc-950 [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl dark:text-stone-50">
                    {resolvedArticle.title}
                  </h1>
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/?${backParams.toString()}`}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" }),
                        "h-8 rounded-full border-black/8 bg-[#eef2f7] px-3 text-[0.78rem] font-semibold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-[#e7ecf4] hover:text-zinc-950 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white",
                      )}
                    >
                      <ChevronLeft className="size-3.5" />
                      {text.backToFeed}
                    </Link>
                    <a
                      href={resolvedArticle.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(getInteractiveChipClassName(false), "inline-flex items-center gap-2")}
                    >
                      <ExternalLink className="size-3.5" />
                      {text.readSource}
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <article className="rounded-[2rem] border border-black/5 bg-white/48 p-1.5 shadow-[0_26px_70px_-45px_rgba(10,10,10,0.46),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="rounded-[1.55rem] bg-[#fcfcfa]/92 p-5 shadow-[inset_0_0_0_1px_rgba(10,10,10,0.04),inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-7 dark:bg-[#10161d]/88 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.04)]">
                <MarkdownRenderer
                  content={resolvedArticle.content || text.contentMissing}
                  sourceUrl={resolvedArticle.url}
                  variant="public"
                  lang={resolvedLang}
                />
              </div>
            </article>
          </div>

          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[106px] lg:self-start">
            <section className="rounded-[2rem] border border-black/5 bg-white/48 p-1.5 shadow-[0_26px_70px_-45px_rgba(10,10,10,0.46),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_28px_80px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="rounded-[1.55rem] bg-[#fcfcfa]/92 p-5 shadow-[inset_0_0_0_1px_rgba(10,10,10,0.04),inset_0_1px_0_rgba(255,255,255,0.85)] dark:bg-[#10161d]/88 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
                      {text.summaryPanelTitle}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-normal text-zinc-950 dark:text-stone-50">
                      {resolvedLang === "zh" ? "快速判断" : "Quick read"}
                    </h2>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-full bg-emerald-900 text-emerald-50 dark:bg-emerald-200 dark:text-emerald-950">
                    <FileText className="size-4" />
                  </span>
                </div>

                <div
                  className={cn(
                    "mt-4 rounded-[1.2rem] border border-black/5 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none",
                    getPublicArticleSummaryContainerClass(),
                  )}
                >
                  <MarkdownSummary
                    content={resolvedArticle.summary || text.summaryMissing}
                    sourceUrl={resolvedArticle.url}
                    variant="public"
                    lang={resolvedLang}
                    className="[&_p]:text-sm [&_p]:text-zinc-600 dark:[&_p]:text-stone-300"
                  />
                </div>

                {resolvedArticle.tags?.length ? (
                  <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
                      {text.summaryPanelTags}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {resolvedArticle.tags.map((tag) => (
                        <Badge
                          key={`${resolvedArticle.id}-${tag}`}
                          variant="outline"
                          className="h-7 border-black/8 bg-[#eef2f7] px-3 text-zinc-600 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-300"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-black/5 bg-white/45 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
              <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
                <Link2 className="size-3.5" />
                {resolvedLang === "zh" ? "来源信息" : "Source info"}
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500 dark:text-stone-400">
                    {text.sourceLabel}
                  </span>
                  <span className="min-w-0 truncate font-medium text-zinc-950 dark:text-stone-100">
                    {resolvedArticle.sourceName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500 dark:text-stone-400">
                    {text.ecosystemLabel}
                  </span>
                  <span className="font-medium text-zinc-950 dark:text-stone-100">
                    {resolvedArticle.ecosystem}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500 dark:text-stone-400">
                    {text.riskLabel}
                  </span>
                  <span className="font-medium text-zinc-950 dark:text-stone-100">
                    {resolvedArticle.riskCategory}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500 dark:text-stone-400">
                    {resolvedLang === "zh" ? "更新时间" : "Updated"}
                  </span>
                  <span className="font-medium text-zinc-950 dark:text-stone-100">
                    {resolvedArticle.updatedAtDisplay}
                  </span>
                </div>
              </div>
              {resolvedArticle.canonicalUrl ? (
                <a
                  href={resolvedArticle.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-8 items-center gap-2 rounded-full border border-black/8 bg-[#eef2f7] px-3 text-[0.78rem] font-semibold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:bg-[#e7ecf4] hover:text-zinc-950 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white"
                >
                  <ExternalLink className="size-3.5" />
                  {text.canonicalUrl}
                </a>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
