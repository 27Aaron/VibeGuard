"use client"

import { useFormStatus } from "react-dom"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AppLang } from "@/lib/i18n"
import { getUiText } from "@/lib/i18n"

type RunWorkerFormProps = {
  action: (formData: FormData) => Promise<void>
  lang: AppLang
}

function SubmitButton({ lang }: { lang: AppLang }) {
  const { pending } = useFormStatus()
  const text = getUiText(lang)

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="submit"
        disabled={pending}
        variant="outline"
        size="lg"
        className="w-full justify-between border-slate-200 bg-white text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.045] dark:text-stone-100 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/[0.08] sm:w-auto"
      >
        <span>{pending ? text.adminRunWorkerPending : text.adminRunWorker}</span>
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      </Button>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {pending
          ? text.adminRunWorkerPendingHint
          : text.adminRunWorkerHint}
      </p>
    </div>
  )
}

export function RunWorkerForm({ action, lang }: RunWorkerFormProps) {
  return (
    <form action={action}>
      <input type="hidden" name="lang" value={lang} />
      <SubmitButton lang={lang} />
    </form>
  )
}
