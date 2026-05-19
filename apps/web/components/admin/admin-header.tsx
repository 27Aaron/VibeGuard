"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Radio, ShieldCheck } from "lucide-react"

import { AdminNav } from "@/components/admin/admin-nav"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { resolveLang, type AppLang } from "@/lib/i18n"

export function AdminHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lang = resolveLang(searchParams.get("lang") ?? undefined)

  const nextLang: AppLang = lang === "zh" ? "en" : "zh"
  const params = new URLSearchParams(searchParams.toString())
  params.set("lang", nextLang)
  const nextHref = `${pathname}?${params.toString()}`

  return (
    <header className="sticky top-3 z-40">
      <div className="w-full min-w-0 rounded-[2rem] border border-black/5 bg-white/45 p-1.5 shadow-[0_20px_55px_-34px_rgba(10,10,10,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl md:rounded-full dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_22px_60px_-36px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="grid min-w-0 gap-3 rounded-[1.55rem] bg-white/58 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:rounded-full md:py-2 dark:bg-[#0c1218]/70">
          <Link
            href={`/?lang=${lang}`}
            className="flex min-w-0 items-center gap-3 rounded-full pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.06)] dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <ShieldCheck className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col items-center gap-0.5">
              <span className="block text-sm font-semibold leading-none tracking-normal">
                VibeGuard
              </span>
              <span className="flex items-center gap-1 text-[0.58rem] font-medium uppercase leading-none tracking-[0.12em] text-zinc-500 dark:text-stone-400">
                <Radio className="size-2.5 text-emerald-700 dark:text-emerald-300" />
                Console
              </span>
            </span>
          </Link>

          <AdminNav current={pathname} lang={lang} />

          <div className="flex items-center justify-end gap-1.5 md:justify-self-end">
            <ThemeToggle />
            <LanguageToggle href={nextHref} currentLang={lang} />
          </div>
        </div>
      </div>
    </header>
  )
}
