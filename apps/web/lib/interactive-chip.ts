import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function getInteractiveChipClassName(active = false) {
  return cn(
    buttonVariants({ size: "sm", variant: "outline" }),
    "h-8 rounded-full border-slate-200/90 bg-white/80 px-3 text-[0.78rem] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 hover:text-slate-950 dark:border-white/12 dark:bg-white/[0.04] dark:text-stone-200 dark:shadow-none dark:hover:bg-white/[0.08] dark:hover:text-white",
    active &&
      "border-slate-900/10 bg-slate-900 text-white hover:bg-slate-950 hover:text-white dark:border-amber-200/40 dark:bg-amber-100/10 dark:text-amber-50 dark:hover:bg-amber-100/12 dark:hover:text-amber-50",
  )
}
