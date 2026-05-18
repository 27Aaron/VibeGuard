"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { getInteractiveChipClassName } from "@/lib/interactive-chip"
import type { AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type PublicTagFilterLink = {
  tag: string
  count: number
  href: string
  active: boolean
}

export function PublicTagFilter({
  visibleTags,
  overflowTags,
  allHref,
  activeTag,
  lang,
}: {
  visibleTags: PublicTagFilterLink[]
  overflowTags: PublicTagFilterLink[]
  allHref: string
  activeTag: string
  lang: AppLang
}) {
  const [query, setQuery] = useState("")
  const labels =
    lang === "zh"
      ? {
          tag: "标签",
          all: "全部标签",
          more: "更多标签",
          search: "搜索标签",
          empty: "没有匹配标签",
        }
      : {
          tag: "Tags",
          all: "All tags",
          more: "More tags",
          search: "Search tags",
          empty: "No matching tags",
        }
  const normalizedQuery = query.trim().toLowerCase()
  const filteredOverflowTags = useMemo(() => {
    if (!normalizedQuery) {
      return overflowTags
    }

    return overflowTags.filter((item) => item.tag.includes(normalizedQuery))
  }, [normalizedQuery, overflowTags])

  if (visibleTags.length === 0 && !activeTag) {
    return null
  }

  return (
    <section className="flex flex-col gap-3 rounded-[1.2rem] border border-black/5 bg-white/62 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
        {labels.tag}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={allHref} className={getInteractiveChipClassName(!activeTag)}>
          {labels.all}
        </Link>
        {visibleTags.map((item) => (
          <TagLink key={item.tag} item={item} />
        ))}
        {overflowTags.length > 0 ? (
          <details className="relative">
            <summary
              className={cn(
                getInteractiveChipClassName(false),
                "cursor-pointer select-none list-none",
              )}
            >
              {labels.more}
            </summary>
            <div className="absolute left-0 z-20 mt-2 w-72 rounded-[1.2rem] border border-black/5 bg-[#fcfcfa]/96 p-3 shadow-[0_20px_50px_-28px_rgba(10,10,10,0.48),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl dark:border-white/10 dark:bg-[#10161d]/96 dark:shadow-[0_22px_54px_-32px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)]">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={labels.search}
                className="mb-3 h-10 w-full rounded-full border border-black/6 bg-[#fcfcfa] px-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 transition-colors focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-emerald-200/30 dark:focus:ring-emerald-200/10"
              />
              <div className="max-h-64 overflow-y-auto pr-1">
                {filteredOverflowTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {filteredOverflowTags.map((item) => (
                      <TagLink key={item.tag} item={item} />
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-zinc-500 dark:text-stone-400">
                    {labels.empty}
                  </p>
                )}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  )
}

function TagLink({ item }: { item: PublicTagFilterLink }) {
  return (
    <Link href={item.href} className={getInteractiveChipClassName(item.active)}>
      {item.tag}
      <span className="ml-1 text-zinc-400 dark:text-stone-500">{item.count}</span>
    </Link>
  )
}
