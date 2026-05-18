import Link from "next/link"
import {
  Braces,
  ChevronLeft,
  ChevronRight,
  FileJson,
  Radio,
  Rss,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react"

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
    <main className="relative min-h-svh overflow-hidden bg-[#f2f2f0] text-zinc-950 [background-image:linear-gradient(135deg,rgba(31,77,63,0.10),transparent_34%),linear-gradient(180deg,#faf9f3_0%,#f1f1ed_48%,#e7ece9_100%)] dark:bg-[#070b0f] dark:text-stone-100 dark:[background-image:linear-gradient(135deg,rgba(74,124,104,0.18),transparent_34%),linear-gradient(180deg,#070b0f_0%,#0e151a_52%,#111820_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-[0.13] dark:[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]" />

      <div className="relative mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-40">
          <div className="w-full min-w-0 rounded-[2rem] border border-black/5 bg-white/45 p-1.5 shadow-[0_20px_55px_-34px_rgba(10,10,10,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl md:rounded-full dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_22px_60px_-36px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="grid min-w-0 gap-3 rounded-[1.55rem] bg-white/58 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:rounded-full md:py-2 dark:bg-[#0c1218]/70">
              <Link
                href={buildListHref({ page: 1 })}
                className="flex min-w-0 items-center gap-3 rounded-full pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] dark:bg-stone-100 dark:text-zinc-950">
                  <ShieldCheck className="size-4" />
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
                  href={buildListHref({ lang: nextLang, page: requestedPage })}
                  currentLang={lang}
                />
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-black/5 bg-white/48 p-1.5 shadow-[0_22px_62px_-42px_rgba(10,10,10,0.42),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_24px_70px_-48px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="rounded-[1.55rem] bg-[#fcfcfa]/92 p-4 shadow-[inset_0_0_0_1px_rgba(10,10,10,0.04),inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-5 dark:bg-[#10161d]/88 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-black/6 bg-white/72 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.055]">
                  <span className="size-1.5 rounded-full bg-emerald-700 shadow-[0_0_0_5px_rgba(4,120,87,0.12)] dark:bg-emerald-300 dark:shadow-[0_0_0_5px_rgba(110,231,183,0.12)]" />
                  {text.publicEyebrowLive}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-black/6 bg-white/72 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.055]">
                  {text.publicEyebrowBilingual}
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
                    "size-11 rounded-full border-black/6 bg-zinc-950 text-stone-50 hover:bg-zinc-800 hover:text-white dark:border-white/10 dark:bg-stone-100 dark:text-zinc-950 dark:hover:bg-white dark:hover:text-zinc-950",
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
                className="group rounded-[1.65rem] border border-black/5 bg-white/50 p-1.5 shadow-[0_20px_44px_-30px_rgba(10,10,10,0.34),inset_0_1px_0_rgba(255,255,255,0.72)] transition-[border-color,transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:border-emerald-900/15 hover:shadow-[0_28px_64px_-34px_rgba(10,10,10,0.42),inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none dark:hover:border-emerald-200/25"
              >
                <Link
                  href={buildArticleHref(article.id)}
                  className="flex flex-col gap-3 rounded-[1.25rem] bg-[#fcfcfa]/92 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 dark:bg-[#10161d]/92"
                >
                  <div className="flex flex-col gap-1.5">
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
                    <h2 className="line-clamp-3 min-h-[5.25rem] text-xl font-semibold leading-7 text-zinc-950 transition-colors group-hover:text-emerald-950 dark:text-stone-50 dark:group-hover:text-emerald-100">
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
          "border-black/6 bg-white text-zinc-700 hover:bg-stone-50 hover:text-zinc-950 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white",
          !hasPreviousPage && "pointer-events-none opacity-40",
        )}
      >
        <ChevronLeft className="size-4" />
        <span className="sr-only">{previousLabel}</span>
      </Link>
      <span className="min-w-20 rounded-full border border-black/6 bg-white px-3 py-1.5 text-center text-sm font-medium text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-stone-200">
        {currentPage} / {totalPages}
      </span>
      <Link
        href={nextHref}
        aria-disabled={!hasNextPage}
        aria-label={nextLabel}
        title={nextLabel}
        className={cn(
          buttonVariants({ size: "icon-sm", variant: "outline" }),
          "border-black/6 bg-white text-zinc-700 hover:bg-stone-50 hover:text-zinc-950 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white",
          !hasNextPage && "pointer-events-none opacity-40",
        )}
      >
        <ChevronRight className="size-4" />
        <span className="sr-only">{nextLabel}</span>
      </Link>
    </nav>
  )
}
