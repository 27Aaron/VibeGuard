import type { ReactNode } from "react"

import type { AppLang } from "@/lib/i18n"
import { getSectionOuterClassName } from "@/lib/layout-tokens"
import { cn } from "@/lib/utils"

type AdminPageShellProps = {
  title: string
  description: string
  children: ReactNode
  lang: AppLang
}

export function AdminPageShell({
  title,
  description,
  children,
  lang,
}: AdminPageShellProps) {
  return (
    <>
      <section className={cn(getSectionOuterClassName(), "px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-none")}>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-stone-50">
            {title}
          </h1>
          <p className="max-w-4xl text-sm text-zinc-600 dark:text-stone-300">
            {description}
          </p>
        </div>
      </section>
      {children}
    </>
  )
}
