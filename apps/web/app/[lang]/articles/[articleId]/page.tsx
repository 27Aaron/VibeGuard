import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ChevronLeft,
  ExternalLink,
  FileText,
  Link2,
  Tags,
} from "lucide-react"

import { MarkdownRenderer, MarkdownSummary } from "@/components/content/markdown-renderer"
import { PublicHeader } from "@/components/public-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getArticleById } from "@/lib/api-articles"
import {
  getPublicArticleSidebarClassName,
  getPublicArticleSummaryContainerClass,
} from "@/lib/article-layout"
import { getInteractiveChipClassName } from "@/lib/interactive-chip"
import { getUiText, resolveLang } from "@/lib/i18n"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
  getSubtlePanelClassName,
} from "@/lib/layout-tokens"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ lang: string; articleId: string }> }): Promise<Metadata> {
  const { lang: rawLang, articleId } = await params
  const lang = resolveLang(rawLang)
  const article = await getArticleById(articleId, lang)

  if (!article) {
    return { title: "Not Found" }
  }

  return {
    title: `${article.title} - VibeGuard`,
    description: article.summary?.slice(0, 160) ?? undefined,
    openGraph: {
      title: article.title,
      description: article.summary?.slice(0, 160) ?? undefined,
      type: "article",
      locale: lang === "zh" ? "zh_CN" : "en_US",
    },
  }
}

type PublicArticlePageProps = {
  params: Promise<{ lang: string; articleId: string }>
  searchParams: Promise<{
    q?: string
    tag?: string
    page?: string
  }>
}

export default async function PublicArticlePage({
  params,
  searchParams,
}: PublicArticlePageProps) {
  const { lang: langParam, articleId } = await params
  const resolvedLang = resolveLang(langParam)
  const { q, tag, page } = await searchParams
  const text = getUiText(resolvedLang)
  const article = await getArticleById(articleId, resolvedLang)

  if (!article) {
    notFound()
  }

  const resolvedArticle = article
  const articleLang = resolveLang(resolvedArticle.locale)

  const backParams = new URLSearchParams()
  if (q) {
    backParams.set("q", q)
  }
  if (tag) {
    backParams.set("tag", tag)
  }
  if (page && page !== "1") {
    backParams.set("page", page)
  }

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />

      <div className={getShellClassName()}>
        <PublicHeader
          homeHref={backParams.toString() ? `/${resolvedArticle.locale}?${backParams.toString()}` : `/${resolvedArticle.locale}`}
          currentLang={articleLang}
        />

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className={cn("min-w-0", getSectionOuterClassName())}>
              <div className={cn("min-w-0 p-5 sm:p-7", getSectionInnerClassName())}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={backParams.toString() ? `/${resolvedArticle.locale}?${backParams.toString()}` : `/${resolvedArticle.locale}`}
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

                <h1 className="mt-6 max-w-5xl text-2xl font-semibold leading-tight tracking-normal text-zinc-950 [overflow-wrap:anywhere] md:text-3xl dark:text-stone-50">
                  {resolvedArticle.title}
                </h1>
              </div>
            </section>

            <article className={getSectionOuterClassName()}>
              <div className={cn("p-5 sm:p-7", getSectionInnerClassName())}>
                <MarkdownRenderer
                  content={resolvedArticle.content || text.contentMissing}
                  sourceUrl={resolvedArticle.url}
                  variant="public"
                  lang={resolvedLang}
                />
              </div>
            </article>
          </div>

          <aside className={getPublicArticleSidebarClassName()}>
            <section className={getSectionOuterClassName()}>
              <div className={getSectionInnerClassName()}>
                <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
                  <FileText className="size-3.5" />
                  {text.summaryPanelTitle}
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
                    <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
                      <Tags className="size-3.5" />
                      {text.summaryPanelTags}
                    </div>
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

                <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                  <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
                    <Link2 className="size-3.5" />
                    {resolvedLang === "zh" ? "来源信息" : "Source info"}
                  </div>
                  <div className="mt-3 grid gap-3 text-sm">
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
                      className="mt-3 inline-flex h-8 items-center gap-2 rounded-full border border-black/8 bg-[#eef2f7] px-3 text-[0.78rem] font-semibold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:bg-[#e7ecf4] hover:text-zinc-950 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white"
                    >
                      <ExternalLink className="size-3.5" />
                      {text.canonicalUrl}
                    </a>
                  ) : null}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
