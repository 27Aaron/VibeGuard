import Link from "next/link"
import {
  Braces,
  FileJson,
  Radio,
  Rss,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { LanguageToggle } from "@/components/language-toggle"
import { ThemeToggle } from "@/components/theme-toggle"
import { getUiText, type AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type PublicSurface = "rss" | "check" | "api" | "mcp" | "skill"

const futureSurfaceLinks: Array<{
  label: string
  icon: LucideIcon
  surface?: PublicSurface
}> = [
  { label: "API", icon: FileJson, surface: "api" },
  { label: "MCP", icon: Braces, surface: "mcp" },
  { label: "RSS", icon: Rss, surface: "rss" },
  { label: "Skill", icon: ShieldCheck, surface: "skill" },
  { label: "Check", icon: Search, surface: "check" },
]

type PublicHeaderProps = {
  homeHref: string
  currentLang: AppLang
  currentSurface?: PublicSurface
}

export function PublicHeader({
  homeHref,
  currentLang,
  currentSurface,
}: PublicHeaderProps) {
  const copy = getUiText(currentLang)

  return (
    <header className="sticky top-3 z-40">
      <div className="w-full min-w-0 rounded-[2rem] border border-black/5 bg-white/45 p-1.5 shadow-[0_20px_55px_-34px_rgba(10,10,10,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl md:rounded-full dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_22px_60px_-36px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="grid min-w-0 gap-3 rounded-[1.55rem] bg-white/58 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:rounded-full md:py-2 dark:bg-[#0c1218]/70">
          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-2.5 rounded-full pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
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
                Live feed
              </span>
            </span>
          </Link>

          <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center md:justify-self-center">
            {futureSurfaceLinks.map((item) => {
              const Icon = item.icon
              const active = currentSurface != null && item.surface === currentSurface
              const className =
                "inline-flex h-8 min-w-0 items-center rounded-full border border-black/8 bg-[#eef2f7] p-[2px] text-xs font-semibold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow,color] duration-200 hover:bg-[#e7ecf4] hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white"
              const surfaceClassName = cn(
                className,
                active &&
                  "border-emerald-900/18 bg-[#dfe9e2] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_1px_2px_rgba(15,23,42,0.08)] hover:bg-[#d6e4da] hover:text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#16221c] dark:hover:text-emerald-50",
              )
              const contentClassName = cn(
                "inline-flex h-[26px] items-center gap-1.5 rounded-full border border-black/8 bg-white px-2.5 text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.14),0_4px_10px_rgba(15,23,42,0.12)] transition-[background-color,color,border-color,box-shadow] duration-200 dark:border-white/10 dark:bg-[#0c1218] dark:text-stone-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_6px_16px_rgba(0,0,0,0.28)]",
                active &&
                  "border-emerald-900/12 bg-[#f7fbf8] text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.10),0_5px_12px_rgba(20,83,45,0.10)] dark:border-emerald-200/12 dark:bg-[#18241e] dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_16px_rgba(0,0,0,0.26)]",
              )
              const iconClassName = cn(
                "size-[14px]",
                active && "text-emerald-800 dark:text-emerald-300",
              )

              const href =
                item.label === "RSS"
                  ? `/${currentLang}/rss`
                  : item.label === "Check"
                    ? `/${currentLang}/check`
                    : item.label === "API"
                      ? `/${currentLang}/api`
                      : item.label === "MCP"
                        ? `/${currentLang}/mcp`
                        : item.label === "Skill"
                          ? `/${currentLang}/skill`
                          : undefined
              const label = item.label === "Check" ? copy.publicCheckNav : item.label

              if (href) {
                return (
                  <Link
                    key={item.label}
                    href={href}
                    prefetch={item.label === "API" || item.label === "MCP" ? false : undefined}
                    className={surfaceClassName}
                  >
                    <span className={contentClassName}>
                      <Icon className={iconClassName} strokeWidth={2} />
                      {label}
                    </span>
                  </Link>
                )
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  aria-disabled="true"
                  title={item.label}
                  className={cn(surfaceClassName, "cursor-default opacity-80")}
                >
                  <span className={contentClassName}>
                    <Icon className={iconClassName} strokeWidth={2} />
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-1.5 md:justify-self-end">
            <ThemeToggle />
            <LanguageToggle
              currentLang={currentLang}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
