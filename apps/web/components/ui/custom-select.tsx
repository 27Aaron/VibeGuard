"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type CustomSelectProps = {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full items-center justify-between rounded-full border border-black/6 bg-[#fcfcfa] px-4 text-sm text-zinc-950 outline-none transition-colors hover:border-black/10 focus-visible:border-emerald-700/30 focus-visible:ring-2 focus-visible:ring-emerald-700/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-100 dark:hover:border-white/15 dark:focus-visible:border-emerald-200/30 dark:focus-visible:ring-emerald-200/10"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? ""}</span>
        <ChevronDown className="ml-2 size-4 shrink-0 text-zinc-500 dark:text-stone-400" />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+0.45rem)] z-20 flex max-h-[280px] w-full flex-col gap-1.5 overflow-y-auto rounded-[1.1rem] border border-black/8 bg-[#fcfcfa] p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-[#1b2028]"
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full items-center rounded-[0.85rem] px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-black/[0.045] text-zinc-950 dark:bg-white/[0.08] dark:text-stone-50"
                    : "text-zinc-700 hover:bg-black/[0.03] dark:text-stone-200 dark:hover:bg-white/[0.05]",
                )}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
