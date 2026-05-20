"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

type AutoRedirectHomeProps = {
  lang: string
}

export function AutoRedirectHome({ lang }: AutoRedirectHomeProps) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(3)

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push(`/${lang}`)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [lang, router])

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
