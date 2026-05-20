"use client"

import { useEffect } from "react"

import { buttonVariants } from "@/components/ui/button"
import {
  getAdminBackgroundClassName,
  getAdminBackdropClassName,
  getAdminShellClassName,
} from "@/lib/admin-layout"

export default function AdminError({
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
    <main className={getAdminBackgroundClassName()}>
      <div className={getAdminBackdropClassName()} />
      <div className={getAdminShellClassName()}>
        <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-black/5 bg-white/48 px-8 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
            Error
          </p>
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-stone-50">
            Something went wrong
          </h1>
          <p className="max-w-md text-sm text-zinc-600 dark:text-stone-300">
            An error occurred while loading this page. Try refreshing.
          </p>
          <button
            type="button"
            onClick={reset}
            className={buttonVariants({ variant: "outline" })}
          >
            Retry
          </button>
        </div>
      </div>
    </main>
  )
}
