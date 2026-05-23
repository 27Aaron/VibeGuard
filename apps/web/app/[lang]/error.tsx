"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import type { AppLang } from "@/lib/i18n"
import { getBackgroundClassName, getBackdropClassName, getShellClassName } from "@/lib/layout-tokens"
import { cn } from "@/lib/utils"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const lang = (useParams().lang as AppLang) || "zh"

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />
      <div className={cn(getShellClassName(), "items-center justify-center")}>
        <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-black/5 bg-white/48 px-8 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
            Error
          </p>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-stone-50">
            {lang === "zh" ? "出了点问题" : "Something went wrong"}
          </h1>
          <p className="max-w-md text-sm text-zinc-600 dark:text-stone-300">
            {lang === "zh"
              ? "页面加载时遇到了错误，请尝试刷新。"
              : "An error occurred while loading this page. Try refreshing."}
          </p>
          <button
            type="button"
            onClick={reset}
            className={buttonVariants({ variant: "outline" })}
          >
            {lang === "zh" ? "重试" : "Retry"}
          </button>
        </div>
      </div>
    </main>
  )
}
