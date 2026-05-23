"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import type { AppLang } from "@/lib/i18n"

type PageSelectProps = {
  currentPage: number
  totalPages: number
  lang: AppLang
  query: string
  tag: string
  label: string
}

export function PageSelect({
  currentPage,
  totalPages,
  lang,
  query,
  tag,
  label,
}: PageSelectProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(String(currentPage))

  function navigateTo(page: number) {
    const clamped = Math.max(1, Math.min(totalPages, page))
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (tag) params.set("tag", tag)
    if (clamped !== 1) params.set("page", String(clamped))
    window.scrollTo(0, 0)
    router.push(`/${lang}?${params.toString()}`)
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    const page = parseInt(inputValue, 10)
    if (!isNaN(page)) {
      navigateTo(page)
    }
    setIsEditing(false)
  }

  function handleBlur() {
    setIsEditing(false)
    setInputValue(String(currentPage))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsEditing(false)
      setInputValue(String(currentPage))
      inputRef.current?.blur()
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          aria-label={label}
          className="h-7 w-16 appearance-none rounded-full border border-emerald-700/30 bg-white px-2 text-center text-[0.8rem] font-medium text-zinc-950 outline-none focus:border-emerald-700/50 focus:ring-2 focus:ring-emerald-700/10 dark:border-emerald-200/30 dark:bg-white/5 dark:text-stone-100 dark:focus:border-emerald-200/50 dark:focus:ring-emerald-200/10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(e) => setInputValue(e.currentTarget.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 pr-2 text-xs text-zinc-400 dark:text-stone-500">
          /{totalPages}
        </span>
      </form>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      className="h-7 min-w-20 rounded-full border border-black/6 bg-white px-3 text-center text-[0.8rem] font-medium text-zinc-700 transition-colors hover:bg-stone-50 hover:text-zinc-950 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10 dark:hover:text-white"
      onClick={() => {
        setIsEditing(true)
        setInputValue(String(currentPage))
      }}
    >
      {currentPage} / {totalPages}
    </button>
  )
}
