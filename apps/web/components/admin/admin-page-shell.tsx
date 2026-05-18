import type { ReactNode } from "react"
import Link from "next/link"
import { Radio, ShieldCheck } from "lucide-react"

import { AdminNav } from "@/components/admin/admin-nav"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  getAdminBackdropClassName,
  getAdminBackgroundClassName,
  getAdminShellClassName,
} from "@/lib/admin-layout"
import type { AppLang } from "@/lib/i18n"

type AdminPageShellProps = {
  title: string
  description: string
  currentNav: string
  currentPath?: string
  children: ReactNode
  lang: AppLang
}

export function AdminPageShell({
  title,
  description,
  currentNav,
  currentPath,
  children,
  lang,
}: AdminPageShellProps) {
  const basePath = currentPath ?? currentNav
  const nextLang = lang === "zh" ? "en" : "zh"
  const nextHref = `${basePath}${basePath.includes("?") ? "&" : "?"}lang=${nextLang}`

  return (
    <main className={getAdminBackgroundClassName()}>
      <div className={getAdminBackdropClassName()} />
      <div className={getAdminShellClassName()}>
        <header className="sticky top-3 z-40">
          <div className="w-full min-w-0 rounded-[2rem] border border-black/5 bg-white/45 p-1.5 shadow-[0_20px_55px_-34px_rgba(10,10,10,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl md:rounded-full dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_22px_60px_-36px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="grid min-w-0 gap-3 rounded-[1.55rem] bg-white/58 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:rounded-full md:py-2 dark:bg-[#0c1218]/70">
              <Link
                href={`/admin?lang=${lang}`}
                className="flex min-w-0 items-center gap-3 rounded-full pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] dark:bg-stone-100 dark:text-zinc-950">
                  <ShieldCheck className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-normal">
                    VibeGuard
                  </span>
                  <span className="flex items-center gap-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-stone-400">
                    <Radio className="size-3 text-emerald-700 dark:text-emerald-300" />
                    Admin console
                  </span>
                </span>
              </Link>

              <AdminNav current={currentNav} lang={lang} />

              <div className="flex items-center justify-end gap-1.5 md:justify-self-end">
                <ThemeToggle />
                <LanguageToggle href={nextHref} currentLang={lang} />
              </div>
            </div>
          </div>
        </header>
        <section className="rounded-[1.5rem] border border-black/5 bg-white/45 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
              {lang === "zh" ? "后台工作台" : "Workspace"}
            </p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-stone-50">
              {title}
            </h1>
            <p className="max-w-4xl text-sm text-zinc-600 dark:text-stone-300">
              {description}
            </p>
          </div>
        </section>
        {children}
      </div>
    </main>
  )
}
