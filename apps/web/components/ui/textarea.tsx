import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[1.1rem] border border-black/6 bg-[#fcfcfa] px-3 py-3 text-base text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors outline-none placeholder:text-zinc-400 hover:bg-white focus-visible:border-emerald-700/30 focus-visible:ring-2 focus-visible:ring-emerald-700/10 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-100 dark:shadow-none dark:placeholder:text-stone-500 dark:hover:bg-white/[0.08] dark:focus-visible:border-emerald-200/30 dark:focus-visible:ring-emerald-200/10 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
