"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import type { AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type ArticleSearchFormProps = {
  lang: AppLang
  defaultValue: string
}

export function ArticleSearchForm({ lang, defaultValue }: ArticleSearchFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  const updateSearch = useCallback((q: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (q) {
      params.set("q", q)
    } else {
      params.delete("q")
    }
    params.set("page", "1")
    router.push(`/${lang}/admin/articles?${params.toString()}`)
  }, [router, searchParams, lang])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateSearch(value.trim())
  }

  const handleClear = () => {
    setValue("")
    updateSearch("")
    inputRef.current?.focus()
  }

  const placeholder = lang === "zh" ? "搜索文章标题..." : "Search article titles..."

  return (
    <form onSubmit={handleSubmit} className="mb-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400 dark:text-stone-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-xl border border-black/8 bg-[#eef2f7] py-2.5 pl-9 pr-9 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow] placeholder:text-zinc-400 focus:border-emerald-900/20 focus:outline-none focus:ring-2 focus:ring-emerald-200/40 dark:border-white/8 dark:bg-[#11161d] dark:placeholder:text-stone-500 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:focus:border-emerald-200/20 dark:focus:ring-emerald-200/20",
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-600 dark:text-stone-500 dark:hover:bg-white/10 dark:hover:text-stone-300"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </form>
  )
}
