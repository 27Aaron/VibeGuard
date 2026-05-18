import Link from "next/link"

import { getInteractiveChipClassName } from "@/lib/interactive-chip"
import type { AppLang } from "@/lib/i18n"
import { getUiText } from "@/lib/i18n"

export function AdminNav({ current, lang }: { current?: string; lang: AppLang }) {
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
        const active = current === link.href

        return (
          <Link
            key={link.href}
            href={`${link.href}?lang=${lang}`}
            aria-current={active ? "page" : undefined}
            className={getInteractiveChipClassName(active)}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
