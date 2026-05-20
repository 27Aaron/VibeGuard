"use client"

import { useEffect, useRef, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

type RedirectCountdownProps = {
  lang: string
}

export function RedirectCountdown({ lang }: RedirectCountdownProps) {
  const [seconds, setSeconds] = useState(3)
  const deadline = useRef<number | null>(null)
  const redirected = useRef(false)

  useEffect(() => {
    deadline.current = Date.now() + 3000
    redirected.current = false
    setSeconds(3)

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil(((deadline.current ?? Date.now()) - Date.now()) / 1000))
      setSeconds(remaining)

      if (remaining === 0 && !redirected.current) {
        redirected.current = true
        clearInterval(timer)
        window.location.replace(`/${lang}`)
      }
    }, 200)

    return () => clearInterval(timer)
  }, [lang])

  return (
    <div className="flex flex-col items-center gap-3">
      <Link
        href={`/${lang}`}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "rounded-full border-emerald-900/15 bg-[#e9f2ec] text-emerald-950 hover:bg-[#d6e4da] hover:text-emerald-950 dark:border-emerald-200/20 dark:bg-emerald-300/10 dark:text-emerald-100 dark:hover:bg-emerald-300/15",
        )}
      >
        {lang === "zh" ? "返回首页" : "Go Home"}
      </Link>
      <span className="text-xs tabular-nums text-zinc-400 dark:text-stone-500">
        {lang === "zh" ? `${seconds} 秒后自动跳转` : `Redirecting in ${seconds}s`}
      </span>
    </div>
  )
}
