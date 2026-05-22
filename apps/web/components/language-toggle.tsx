"use client"

import { startTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Languages } from "lucide-react"

import type { AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type LanguageToggleProps = {
  href: string
  currentLang: AppLang
  className?: string
}

export function LanguageToggle({
  href,
  currentLang,
  className,
}: LanguageToggleProps) {
  const router = useRouter()
  const nextLabel = currentLang === "zh" ? "切换到英文" : "Switch to Chinese"

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        startTransition(() => {
          router.push(href)
        })
      })
    } else {
      router.push(href)
    }
  }, [href, router])

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full border border-black/8 bg-[#eef2f7] p-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow,color] duration-200 hover:bg-[#e7ecf4] hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white",
        className,
      )}
    >
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-black/8 bg-white text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.14),0_4px_10px_rgba(15,23,42,0.12)] transition-[background-color,color,border-color,box-shadow] duration-200 dark:border-white/10 dark:bg-[#0c1218] dark:text-stone-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_6px_16px_rgba(0,0,0,0.28)]">
        <Languages className="size-[14px]" strokeWidth={2} />
      </span>
    </button>
  )
}
