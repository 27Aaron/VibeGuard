import Link from "next/link"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"

import { PublicTagFilter } from "@/components/public-tag-filter"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { getUiText, resolveLang, type AppLang } from "@/lib/i18n"
import { getPublicArticleFeed, getPublicTags } from "@/lib/public-data"
import { buildPublicTagFilterModel } from "@/lib/public-tag-filters"
import { buildSummaryPreviewText } from "@/lib/summary-preview"
import { formatDateTimeInShanghai } from "@/lib/time"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type PublicHomePageProps = {
  searchParams?: Promise<{
    lang?: string
    q?: string
    tag?: string
    page?: string
  }>
}

export default async function PublicHomePage({ searchParams }: PublicHomePageProps) {
  const params = (await searchParams) ?? {}
  const lang = resolveLang(params.lang)
  const text = getUiText(lang)
  const query = params.q?.trim() ?? ""
  const tag = params.tag?.trim().toLowerCase() ?? ""
  const page = params.page?.trim() ?? "1"

  const urlSearchParams = new URLSearchParams({
    lang,
    limit: "12",
    page,
  })

  if (query) urlSearchParams.set("q", query)
  if (tag) urlSearchParams.set("tag", tag)

  const [feed, tagCounts] = await Promise.all([
    getPublicArticleFeed(urlSearchParams),
    getPublicTags(),
  ])

  const requestedPage = feed.meta.page
  const totalPages = feed.meta.totalPages
  const currentPage = Math.min(requestedPage, totalPages)
  const hasPreviousPage = currentPage > 1
  const hasNextPage = currentPage < totalPages
  const hasActiveFilters = Boolean(query || tag)
  const nextLang = lang === "zh" ? "en" : "zh"
  const tagFilterModel = buildPublicTagFilterModel(tagCounts, tag, 12)

  function buildListHref(next: {
    lang?: string
    q?: string
    tag?: string
    page?: number
  }) {
    const hrefParams = new URLSearchParams()
    hrefParams.set("lang", next.lang ?? lang)

    if (next.q ?? query) {
      hrefParams.set("q", next.q ?? query)
    }
    if (next.tag ?? tag) {
      hrefParams.set("tag", next.tag ?? tag)
    }

    const nextPage = next.page ?? requestedPage
    if (nextPage > 1) {
      hrefParams.set("page", String(nextPage))
    }

    const serialized = hrefParams.toString()
    return serialized ? `/?${serialized}` : "/"
  }

  function buildArticleHref(articleId: string) {
    const hrefParams = new URLSearchParams()
    hrefParams.set("lang", lang)
    if (query) hrefParams.set("q", query)
    if (tag) hrefParams.set("tag", tag)
    if (currentPage > 1) hrefParams.set("page", String(currentPage))
    return `/articles/${articleId}?${hrefParams.toString()}`
  }

  const visibleTagLinks = tagFilterModel.visibleTags.map((item) => ({
    ...item,
    href: buildListHref({ tag: item.active ? "" : item.tag, page: 1 }),
  }))
  const overflowTagLinks = tagFilterModel.overflowTags.map((item) => ({
    ...item,
    href: buildListHref({ tag: item.tag, page: 1 }),
  }))

  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_56%,#eef2f7_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#090d12_0%,#0f141b_56%,#131922_100%)] dark:text-stone-100">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6 px-6 pt-8 pb-5 xl:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200/75 pb-6 dark:border-white/10">
          <div className="flex items-center justify-end gap-1.5">
            <ThemeToggle />
            <LanguageToggle
              href={buildListHref({ lang: nextLang, page: requestedPage })}
              currentLang={lang}
            />
          </div>

          <div className="rounded-2xl border border-slate-200/75 bg-white/88 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] md:p-5 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
            <form action="/" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="lang" value={lang} />
              {tag ? <input type="hidden" name="tag" value={tag} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder={text.publicSearchPlaceholder}
                className="h-10 min-w-[220px] flex-1 rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] focus:border-slate-300 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-amber-100/30 dark:shadow-none"
              />
              <button
                type="submit"
                aria-label={text.search}
                title={text.search}
                className={cn(
                  buttonVariants({ size: "icon", variant: "outline" }),
                  "size-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white",
                )}
              >
                <Search className="size-4" />
                <span className="sr-only">{text.search}</span>
              </button>
              {query ? (
                <Link
                  href={buildListHref({ q: "", page: 1 })}
                  aria-label={text.clear}
                  title={text.clear}
                  className={cn(
                    buttonVariants({ size: "icon", variant: "outline" }),
                    "size-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white",
                  )}
                >
                  <X className="size-4" />
                  <span className="sr-only">{text.clear}</span>
                </Link>
              ) : null}
            </form>

            {tagFilterModel.hasTags ? (
              <div className="mt-4">
                <PublicTagFilter
                  visibleTags={visibleTagLinks}
                  overflowTags={overflowTagLinks}
                  allHref={buildListHref({ tag: "", page: 1 })}
                  activeTag={tag}
                  lang={lang}
                />
              </div>
            ) : null}

            {hasActiveFilters ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/75 pt-4 text-sm text-slate-600 dark:border-white/10 dark:text-stone-300">
                <span className="text-slate-500 dark:text-stone-400">{text.currentFilters}</span>
                {query ? (
                  <Badge variant="outline" className="border-slate-200 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-stone-200">
                    {text.keywordLabel}：{query}
                  </Badge>
                ) : null}
                {tag ? (
                  <Badge variant="outline" className="border-slate-200 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-stone-200">
                    {lang === "zh" ? "标签" : "Tag"}：{tag}
                  </Badge>
                ) : null}
                <Link
                  href={buildListHref({
                    q: "",
                    tag: "",
                    page: 1,
                  })}
                  className="ml-auto inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.045] dark:text-stone-300 dark:hover:border-white/20 dark:hover:text-stone-100"
                >
                  {text.clearAllFilters}
                </Link>
              </div>
            ) : null}
          </div>
        </header>

        <section className="flex items-center justify-between gap-4 text-sm text-slate-500 dark:text-stone-400">
          <p className="text-sm font-medium text-slate-600 dark:text-stone-300">
            {lang === "zh"
              ? `共 ${feed.meta.totalCount} 篇可读文章`
              : `${feed.meta.totalCount} readable articles`}
          </p>
        </section>

        {feed.items.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300/90 bg-white/70 px-6 py-12 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)] dark:border-white/15 dark:bg-white/[0.04] dark:shadow-none">
            <p className="text-lg font-medium text-slate-900 dark:text-stone-100">{text.emptyFeedTitle}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-stone-400">{text.emptyFeedBody}</p>
          </section>
        ) : (
          <section className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {feed.items.map((article) => (
              <article
                key={article.id}
                className="group rounded-2xl border border-slate-200/75 bg-white/88 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-amber-100/25 dark:hover:shadow-none"
              >
                <Link
                  href={buildArticleHref(article.id)}
                  className="flex flex-col gap-3 rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-stone-400">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[11px] font-medium tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-stone-300">
                        {article.sourceName.toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-[11px] tracking-[0.18em] text-slate-400 dark:text-stone-500">
                      {formatDateTimeInShanghai(article.publishedAt)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <h2 className="line-clamp-3 min-h-[5.25rem] text-xl font-semibold leading-7 text-slate-950 transition-colors group-hover:text-slate-700 dark:text-stone-50 dark:group-hover:text-amber-50">
                      {article.title}
                    </h2>
                    <p className="line-clamp-3 text-sm leading-6 text-slate-600 dark:text-stone-300">
                      {buildSummaryPreviewText(
                        article.summary ||
                          (lang === "zh"
                            ? "文章处理完成后，这里会显示摘要。"
                            : "A summary will appear here after processing finishes."),
                      )}
                    </p>
                  </div>

                  {article.tags?.length ? (
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {article.tags.slice(0, 5).map((tag) => (
                          <Badge
                            key={`${article.id}-${tag}`}
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-400"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div aria-hidden="true" />
                  )}
                </Link>
              </article>
            ))}
          </section>
        )}

        <footer className="flex justify-center border-t border-slate-200/75 pt-4 dark:border-white/10">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            hasPreviousPage={hasPreviousPage}
            hasNextPage={hasNextPage}
            previousHref={buildListHref({ page: Math.max(1, currentPage - 1) })}
            nextHref={buildListHref({ page: currentPage + 1 })}
            previousLabel={text.pagePrev}
            nextLabel={text.pageNext}
            lang={lang}
          />
        </footer>
      </div>
    </main>
  )
}

function PaginationControls({
  currentPage,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  previousHref,
  nextHref,
  previousLabel,
  nextLabel,
  lang,
}: {
  currentPage: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  previousHref: string
  nextHref: string
  previousLabel: string
  nextLabel: string
  lang: AppLang
}) {
  return (
    <nav
      aria-label={lang === "zh" ? "文章分页" : "Article pagination"}
      className="flex items-center gap-2"
    >
      <Link
        href={previousHref}
        aria-disabled={!hasPreviousPage}
        aria-label={previousLabel}
        title={previousLabel}
        className={cn(
          buttonVariants({ size: "icon-sm", variant: "outline" }),
          "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white",
          !hasPreviousPage && "pointer-events-none opacity-40",
        )}
      >
        <ChevronLeft className="size-4" />
        <span className="sr-only">{previousLabel}</span>
      </Link>
      <span className="min-w-20 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-center text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-stone-200">
        {currentPage} / {totalPages}
      </span>
      <Link
        href={nextHref}
        aria-disabled={!hasNextPage}
        aria-label={nextLabel}
        title={nextLabel}
        className={cn(
          buttonVariants({ size: "icon-sm", variant: "outline" }),
          "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white",
          !hasNextPage && "pointer-events-none opacity-40",
        )}
      >
        <ChevronRight className="size-4" />
        <span className="sr-only">{nextLabel}</span>
      </Link>
    </nav>
  )
}
