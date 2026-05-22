"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"

export type ParamDef = {
  key: string
  label: string
  detail: string
  examples?: Array<{ label: string; href: string }>
}

export function EndpointCard({
  method,
  path,
  description,
  params,
  lang,
}: {
  method: "GET" | "POST"
  path: string
  description: string
  params?: ParamDef[]
  lang: string
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="rounded-[1.4rem] border border-black/5 bg-white/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="flex items-center gap-2.5 mb-2">
        <Badge
          variant="secondary"
          className={
            method === "GET"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
          }
        >
          {method}
        </Badge>
        <span className="font-mono text-sm font-semibold text-zinc-950 dark:text-stone-100">{path}</span>
      </div>

      <p className="text-xs leading-relaxed text-zinc-600 dark:text-stone-400 mb-3">
        {description}
      </p>

      {params && params.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {params.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setExpanded(expanded === p.key ? null : p.key)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.65rem] transition-all cursor-pointer ${
                expanded === p.key
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                  : "border-black/6 bg-[#f7f7f5] dark:border-white/8 dark:bg-white/[0.04] hover:border-black/12 dark:hover:border-white/16"
              }`}
            >
              <span className="font-mono font-semibold text-zinc-800 dark:text-stone-200">{p.key}</span>
              <span className="text-zinc-500 dark:text-stone-400">{p.label}</span>
            </button>
          ))}
        </div>
      )}

      {expanded && params && (() => {
        const p = params.find((x) => x.key === expanded)
        if (!p) return null
        return (
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-mono text-xs font-semibold text-emerald-900 dark:text-emerald-200">{p.key}</span>
                  <span className="text-[0.65rem] text-emerald-700 dark:text-emerald-400">{p.label}</span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-700 dark:text-stone-300">
                  {p.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="shrink-0 rounded-md p-0.5 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors cursor-pointer"
                aria-label={lang === "zh" ? "收起" : "Collapse"}
              >
                <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.22 9.22a.75.75 0 0 1 1.06 0L6 10.94l4.72-4.72a.75.75 0 1 1 1.06 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0L3.22 10.28a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
            </div>

            {p.examples && p.examples.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 border-t border-emerald-200/40 dark:border-emerald-800/30 pt-2">
                <span className="text-[0.6rem] font-medium uppercase tracking-wider text-emerald-700/60 dark:text-emerald-400/50 mb-0.5">
                  {lang === "zh" ? "示例" : "Examples"}
                </span>
                {p.examples.map((ex) => (
                  <a
                    key={ex.label}
                    href={ex.href}
                    className="font-mono text-[0.7rem] text-emerald-800 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200 transition-colors truncate"
                  >
                    {ex.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
