import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react"

import { PageSelect } from "@/components/page-select"
import { PublicHeader } from "@/components/public-header"
import { PublicTagFilter } from "@/components/public-tag-filter"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getUiText, resolveLang, type AppLang } from "@/lib/i18n"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getCardSurfaceClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens"
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
    limit: "15",
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
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />

      <div className={getShellClassName()}>
        <PublicHeader
          homeHref={buildListHref({ page: 1 })}
          nextLangHref={buildListHref({ lang: nextLang, page: requestedPage })}
          currentLang={lang}
        />

        <section className={getSectionOuterClassName()}>
          <div className={getSectionInnerClassName()}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-normal text-zinc-600 dark:text-stone-300">
                <span className="inline-flex h-7 items-center gap-2 rounded-full border border-black/6 bg-white/72 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-none">
                  <span className="size-1.5 rounded-full bg-emerald-700 shadow-[0_0_0_5px_rgba(4,120,87,0.12)] dark:bg-emerald-300 dark:shadow-[0_0_0_5px_rgba(110,231,183,0.12)]" />
                  {text.publicEyebrowLive}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-stone-400">
                <Badge variant="outline" className="h-7 px-3">
                  {lang === "zh"
                    ? `${feed.meta.totalCount} 篇`
                    : `${feed.meta.totalCount} articles`}
                </Badge>
                <Badge variant="outline" className="h-7 px-3">
                  {lang === "zh"
                    ? `${tagCounts.length} 个标签`
                    : `${tagCounts.length} tags`}
                </Badge>
              </div>
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-black/5 bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
              <form action="/" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="lang" value={lang} />
                {tag ? <input type="hidden" name="tag" value={tag} /> : null}
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder={text.publicSearchPlaceholder}
                  className="h-11 min-w-0 flex-1 rounded-full border border-black/6 bg-[#fcfcfa] px-4 text-sm text-zinc-950 placeholder:text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus:border-emerald-700/30 focus:outline-none dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-emerald-200/30 dark:shadow-none"
                />
                <button
                  type="submit"
                  aria-label={text.search}
                  title={text.search}
                  className={cn(
                    buttonVariants({ size: "icon", variant: "outline" }),
                    "size-11 rounded-full border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-[#dcebe2] hover:text-emerald-950 dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.24)] dark:hover:bg-emerald-300/14 dark:hover:text-emerald-50",
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
                      "size-11 rounded-full border-black/6 bg-white/80 text-zinc-600 hover:bg-white hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white",
                    )}
                  >
                    <X className="size-4" />
                    <span className="sr-only">{text.clear}</span>
                  </Link>
                ) : null}
              </form>

              {tagFilterModel.hasTags ? (
                <div className="mt-3">
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
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 text-sm text-zinc-600 dark:border-white/10 dark:text-stone-300">
                  <span className="text-zinc-500 dark:text-stone-400">
                    {text.currentFilters}
                  </span>
                  {query ? (
                    <Badge variant="outline" className="h-7 px-3">
                      {text.keywordLabel}：{query}
                    </Badge>
                  ) : null}
                  {tag ? (
                    <Badge variant="outline" className="h-7 px-3">
                      {lang === "zh" ? "标签" : "Tag"}：{tag}
                    </Badge>
                  ) : null}
                  <Link
                    href={buildListHref({
                      q: "",
                      tag: "",
                      page: 1,
                    })}
                    className="ml-auto inline-flex h-8 items-center rounded-full border border-black/6 bg-white/70 px-3 text-sm text-zinc-500 transition-colors hover:bg-white hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-stone-100"
                  >
                    {text.clearAllFilters}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {feed.items.length === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-black/10 bg-white/55 px-6 py-12 text-center shadow-[0_18px_48px_rgba(10,10,10,0.06)] dark:border-white/15 dark:bg-white/[0.04] dark:shadow-none">
            <p className="text-lg font-medium text-zinc-950 dark:text-stone-100">
              {text.emptyFeedTitle}
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-stone-400">
              {text.emptyFeedBody}
            </p>
          </section>
        ) : (
          <section className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {feed.items.map((article) => (
              <article
                key={article.id}
                className={cn("group", getCardSurfaceClassName())}
              >
                <Link
                  href={buildArticleHref(article.id)}
                  className="flex flex-col gap-3 rounded-[1.25rem] bg-[#fcfcfa]/92 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 dark:bg-[#10161d]/92"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-stone-400">
                      <Badge variant="outline" className="border-black/6 bg-white/70 text-[11px] font-semibold tracking-[0.18em] text-zinc-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-300">
                        {article.sourceName.toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-[11px] tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                      {formatDateTimeInShanghai(article.publishedAt)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <h2 className="line-clamp-1 text-base font-semibold leading-7 text-zinc-950 transition-colors group-hover:text-emerald-950 dark:text-stone-50 dark:group-hover:text-emerald-100">
                      {article.title}
                    </h2>
                    <p className="line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-stone-300">
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
                            className="border-black/6 bg-white/65 text-zinc-500 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-400"
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

        <footer className="flex justify-center border-t border-black/5 pt-4 dark:border-white/10">
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
            langParam={lang}
            query={query}
            tag={tag}
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
  langParam,
  query,
  tag,
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
  langParam: string
  query: string
  tag: string
}) {
  return (
    <nav
      aria-label={lang === "zh" ? "文章分页" : "Article pagination"}
      className="flex items-center gap-2"
    >
      <Link
        href={previousHref}
        scroll={false}
        aria-disabled={!hasPreviousPage}
        aria-label={previousLabel}
        title={previousLabel}
        className={cn(
          buttonVariants({ size: "sm", variant: "outline" }),
          !hasPreviousPage && "pointer-events-none opacity-50",
        )}
      >
        <ChevronLeft className="size-3.5" />
        {lang === "zh" ? "上一页" : "Previous"}
      </Link>
      <PageSelect
        currentPage={currentPage}
        totalPages={totalPages}
        lang={langParam}
        query={query}
        tag={tag}
        label={lang === "zh" ? "跳转到页码" : "Jump to page"}
      />
      <Link
        href={nextHref}
        scroll={false}
        aria-disabled={!hasNextPage}
        aria-label={nextLabel}
        title={nextLabel}
        className={cn(
          buttonVariants({ size: "sm", variant: "outline" }),
          !hasNextPage && "pointer-events-none opacity-50",
        )}
      >
        {lang === "zh" ? "下一页" : "Next"}
        <ChevronRight className="size-3.5" />
      </Link>
    </nav>
  )
}
