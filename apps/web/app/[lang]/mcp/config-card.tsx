"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

export function ConfigCard({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group relative flex flex-col rounded-[1rem] border border-black/5 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-2 dark:border-white/8">
        <p className="text-xs font-medium text-zinc-700 dark:text-stone-300">{title}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.65rem] text-zinc-400 transition-colors hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/8 dark:hover:text-stone-200"
          aria-label="Copy"
        >
          {copied
            ? <><Check className="size-3 text-emerald-600 dark:text-emerald-400" /><span className="text-emerald-600 dark:text-emerald-400">Copied</span></>
            : <><Copy className="size-3" /><span>Copy</span></>}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed">
        <code className="font-mono text-zinc-800 dark:text-stone-300">{code}</code>
      </pre>
    </div>
  )
}
