import type { ReactNode } from "react"

import { AdminNav } from "@/components/admin/admin-nav"
import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { getAdminBackgroundClassName, getAdminShellClassName } from "@/lib/admin-layout"
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
      <div className={getAdminShellClassName()}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/75 pb-6 dark:border-white/10">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-stone-50">{title}</h1>
            <p className="text-sm text-slate-500 dark:text-stone-400">{description}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <LanguageToggle href={nextHref} currentLang={lang} />
          </div>
        </div>
        <AdminNav current={currentNav} lang={lang} />
        {children}
      </div>
    </main>
  )
}
