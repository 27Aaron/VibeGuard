import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ExternalLink } from "lucide-react"

import { MarkdownRenderer, MarkdownSummary } from "@/components/content/markdown-renderer"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { getArticleStatusLabel } from "@/lib/content-labels"
import { getPublicArticleSummaryContainerClass } from "@/lib/article-layout"
import { getInteractiveChipClassName } from "@/lib/interactive-chip"
import { getUiText, resolveLang } from "@/lib/i18n"
import { formatDateTimeInShanghai } from "@/lib/time"
import { cn } from "@/lib/utils"
import { getArticleById } from "@/lib/api-articles"

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
    <main className="min-h-svh bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_56%,#eef2f7_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#090d12_0%,#0f141b_56%,#131922_100%)] dark:text-stone-100">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-8 xl:px-8">
        <header className="flex flex-col gap-5 border-b border-slate-200/75 pb-8 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href={`/?${backParams.toString()}`}
              className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-stone-400 dark:hover:text-stone-100"
            >
              <ChevronLeft className="size-4" />
              {text.backToFeed}
            </Link>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <LanguageToggle
                href={buildArticleHref(nextLang)}
                currentLang={articleLang}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-stone-400">
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-stone-300"
            >
              {resolvedArticle.sourceName}
            </Badge>
            <span>{getArticleStatusLabel(resolvedArticle.status, resolvedLang)}</span>
            <span>{formatDateTimeInShanghai(resolvedArticle.publishedAt)}</span>
          </div>

          <div className="flex flex-col gap-4">
            <h1 className="max-w-6xl text-4xl font-semibold leading-tight text-slate-950 dark:text-stone-50">
              {resolvedArticle.title}
            </h1>
            <section className="rounded-2xl border border-slate-200/75 bg-white/80 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                <div className={cn("flex flex-col gap-3", getPublicArticleSummaryContainerClass())}>
                  <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-400 dark:text-stone-500">
                    {text.summaryPanelTitle}
                  </p>
                  <MarkdownSummary
                    content={resolvedArticle.summary || text.summaryMissing}
                    sourceUrl={resolvedArticle.url}
                    variant="public"
                    lang={resolvedLang}
                    className="[&_p]:text-slate-600 dark:[&_p]:text-stone-300"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  <a
                    href={resolvedArticle.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(getInteractiveChipClassName(false), "inline-flex items-center gap-2")}
                  >
                    <ExternalLink className="size-4" />
                    {text.readSource}
                  </a>
                  {resolvedArticle.canonicalUrl ? (
                    <a
                      href={resolvedArticle.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-stone-400 dark:hover:text-stone-100"
                    >
                      {text.canonicalUrl}
                    </a>
                  ) : null}
                </div>
              </div>

              {resolvedArticle.tags?.length ? (
                <div className="mt-5 border-t border-slate-200/75 pt-4 dark:border-white/10">
                  <div className="flex flex-col gap-3">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-400 dark:text-stone-500">
                      {text.summaryPanelTags}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {resolvedArticle.tags.map((tag) => (
                        <Badge
                          key={`${resolvedArticle.id}-${tag}`}
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-400"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </header>

        <article className="rounded-2xl border border-slate-200/75 bg-white/88 p-6 shadow-[0_16px_36px_rgba(15,23,42,0.06)] md:p-8 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
          <MarkdownRenderer
            content={resolvedArticle.content || text.contentMissing}
            sourceUrl={resolvedArticle.url}
            variant="public"
            lang={resolvedLang}
          />
        </article>
      </div>
    </main>
  )
}
