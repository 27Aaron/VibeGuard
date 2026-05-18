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
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200/75 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-400 dark:text-stone-500">
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
            <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_42px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#151a20] dark:shadow-none">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={labels.search}
                className="mb-3 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-stone-100 dark:placeholder:text-stone-500"
              />
              <div className="max-h-64 overflow-y-auto pr-1">
                {filteredOverflowTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {filteredOverflowTags.map((item) => (
                      <TagLink key={item.tag} item={item} />
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-slate-500 dark:text-stone-400">
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
      <span className="ml-1 text-slate-400 dark:text-stone-500">{item.count}</span>
    </Link>
  )
}
