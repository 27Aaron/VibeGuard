"use client"

import { useEffect } from "react"

import { buttonVariants } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#f2f2f0] [background-image:linear-gradient(135deg,rgba(31,77,63,0.10),transparent_34%),linear-gradient(180deg,#faf9f3_0%,#f1f1ed_48%,#e7ece9_100%)] dark:bg-[#070b0f] dark:[background-image:linear-gradient(135deg,rgba(74,124,104,0.18),transparent_34%),linear-gradient(180deg,#070b0f_0%,#0e151a_52%,#111820_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-[0.13] dark:[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
      <div className="relative mx-auto flex min-h-svh w-full min-w-0 max-w-[1440px] flex-col items-center justify-center gap-6 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-black/5 bg-white/48 px-8 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
            Error
          </p>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-stone-50">
            出了点问题
          </h1>
          <p className="max-w-md text-sm text-zinc-600 dark:text-stone-300">
            页面加载时遇到了错误，请尝试刷新。
          </p>
          <button
            type="button"
            onClick={reset}
            className={buttonVariants({ variant: "outline" })}
          >
            重试
          </button>
        </div>
      </div>
    </main>
  )
}
