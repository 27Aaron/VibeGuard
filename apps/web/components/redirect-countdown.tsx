"use client"

import { useEffect, useRef, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

type RedirectCountdownProps = {
  lang: string
}

export function RedirectCountdown({ lang }: RedirectCountdownProps) {
  const [seconds, setSeconds] = useState(3)
  const deadline = useRef(Date.now() + 3000)
  const redirected = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
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
    <div className="flex items-center gap-3">
      <Link
        href={`/${lang}`}
        className={buttonVariants({ variant: "outline" })}
      >
        {lang === "zh" ? "立即返回首页" : "Go home now"}
      </Link>
      <span className="text-xs text-zinc-400 dark:text-stone-500">
        {seconds}s
      </span>
    </div>
  )
}
