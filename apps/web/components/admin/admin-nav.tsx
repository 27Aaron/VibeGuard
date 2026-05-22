"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { AppLang } from "@/lib/i18n"
import { getUiText } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const shellClassName =
  "inline-flex h-8 min-w-0 items-center rounded-full border border-black/8 bg-[#eef2f7] p-[2px] text-xs font-semibold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow,color] duration-200 hover:bg-[#e7ecf4] hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white"

const activeShellClassName =
  "border-emerald-900/18 bg-[#dfe9e2] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_1px_2px_rgba(15,23,42,0.08)] hover:bg-[#d6e4da] hover:text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#16221c] dark:hover:text-emerald-50"

const pillClassName =
  "inline-flex h-[26px] items-center rounded-full border border-black/8 bg-white px-2.5 text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.14),0_4px_10px_rgba(15,23,42,0.12)] transition-[background-color,color,border-color,box-shadow] duration-200 dark:border-white/10 dark:bg-[#0c1218] dark:text-stone-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_6px_16px_rgba(0,0,0,0.28)]"

const activePillClassName =
  "border-emerald-900/12 bg-[#f7fbf8] text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.10),0_5px_12px_rgba(20,83,45,0.10)] dark:border-emerald-200/12 dark:bg-[#18241e] dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_16px_rgba(0,0,0,0.26)]"

export function AdminNav({ lang }: { lang: AppLang }) {
  const pathname = usePathname()
  const adminLinks = [
    { href: "/admin", label: getUiText(lang).adminNavOverview },
    { href: "/admin/feeds", label: getUiText(lang).adminNavFeeds },
    { href: "/admin/articles", label: getUiText(lang).adminNavArticles },
    { href: "/admin/jobs", label: getUiText(lang).adminNavJobs },
    { href: "/admin/settings", label: getUiText(lang).adminNavSettings },
  ]

  return (
    <nav className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center md:justify-self-center">
      {adminLinks.map((link) => {
        const hrefWithLang = `/${lang}${link.href}`
        const active =
          pathname === hrefWithLang ||
          (link.href !== "/admin" && pathname.startsWith(`${hrefWithLang}/`))

        return (
          <Link
            key={link.href}
            href={hrefWithLang}
            aria-current={active ? "page" : undefined}
            className={cn(shellClassName, active && activeShellClassName)}
          >
            <span className={cn(pillClassName, active && activePillClassName)}>
              {link.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
