"use client"

import { useEffect, useRef, useState } from "react"

import { MoonStar, SunMedium } from "lucide-react"

import { createThemeTransition, prefersReducedMotion } from "@/lib/theme-transition"
import {
  applyResolvedTheme,
  readStoredThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  className?: string
}

function readResolvedThemeFromDom(): "light" | "dark" {
  if (typeof document === "undefined") {
    return "dark"
  }

  const resolved = document.documentElement.dataset.theme
  if (resolved === "light" || resolved === "dark") {
    return resolved
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function resolveTheme(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return "dark"
  }

  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }

  return preference
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [mounted, setMounted] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setMounted(true)
    const preference: ThemePreference = readStoredThemePreference()

    const applyTheme = (nextPreference: ThemePreference) => {
      const resolved = resolveTheme(nextPreference)
      applyResolvedTheme(resolved)
      setTheme(resolved)
    }

    applyTheme(preference)

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const latest = window.localStorage.getItem(THEME_STORAGE_KEY)
      const latestPreference: ThemePreference =
        latest === "light" || latest === "dark" ? latest : "system"

      if (latestPreference === "system") {
        applyTheme("system")
      }
    }

    mediaQuery.addEventListener("change", onChange)
    return () => mediaQuery.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (!mounted) {
      return
    }

    setTheme(readResolvedThemeFromDom())
  }, [mounted])

  const isDark = theme === "dark"

  function toggleTheme() {
    if (isAnimating) {
      return
    }

    const next = isDark ? "light" : "dark"
    const rect = buttonRef.current?.getBoundingClientRect()
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2

    const transition = createThemeTransition({
      originX,
      originY,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches || prefersReducedMotion(),
      applyTheme: () => {
        applyResolvedTheme(next)
        setTheme(next)
      },
    })

    window.localStorage.setItem(THEME_STORAGE_KEY, next)

    setIsAnimating(true)

    transition.finished.finally(() => {
      transition.cleanup()
      setIsAnimating(false)
    })
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggleTheme}
      aria-label={mounted ? (isDark ? "切换到亮色主题" : "切换到暗色主题") : "切换主题"}
      aria-pressed={mounted ? isDark : undefined}
      disabled={isAnimating}
      className={cn(
        "relative inline-flex h-8 w-14 items-center rounded-full border border-black/8 bg-[#eef2f7] p-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow,transform] duration-[980ms] ease-[cubic-bezier(0.08,0.82,0.17,1)] hover:bg-[#e7ecf4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 disabled:pointer-events-none dark:border-white/8 dark:bg-[#11161d] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute left-[2px] top-[2px] flex h-[26px] w-[26px] translate-x-0 items-center justify-center rounded-full border border-black/8 bg-white text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.14),0_4px_10px_rgba(15,23,42,0.12)] transition-[transform,background-color,color,border-color,box-shadow] duration-[980ms] ease-[cubic-bezier(0.08,0.82,0.17,1)] dark:translate-x-[24px] dark:border-white/10 dark:bg-[#0c1218] dark:text-stone-100 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_6px_16px_rgba(0,0,0,0.28)]",
        )}
      >
        <span className="relative flex h-[14px] w-[14px] items-center justify-center overflow-visible">
          <SunMedium
            className={cn(
              "absolute size-[14px] opacity-100 transition-[opacity,transform] duration-[980ms] ease-[cubic-bezier(0.08,0.82,0.17,1)] scale-100 rotate-0 dark:opacity-0 dark:scale-[0.68] dark:rotate-[-24deg]",
            )}
            strokeWidth={2}
          />
          <MoonStar
            className={cn(
              "absolute size-[14px] opacity-0 transition-[opacity,transform] duration-[980ms] ease-[cubic-bezier(0.08,0.82,0.17,1)] scale-[0.68] rotate-[24deg] dark:opacity-100 dark:scale-100 dark:rotate-0",
            )}
            strokeWidth={2}
          />
        </span>
      </span>
      <span className="sr-only">{isDark ? "暗色主题" : "亮色主题"}</span>
    </button>
  )
}
