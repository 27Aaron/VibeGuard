"use client";

import { useFormStatus } from "react-dom";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppLang } from "@/lib/i18n";
import { getUiText } from "@/lib/i18n";

type RunWorkerFormProps = {
  action: (formData: FormData) => Promise<void>;
  lang: AppLang;
};

function SubmitButton({ lang }: { lang: AppLang }) {
  const { pending } = useFormStatus();
  const text = getUiText(lang);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="submit"
        disabled={pending}
        variant="outline"
        size="lg"
        className="w-full justify-between rounded-full border-emerald-900/14 bg-[#f7fbf8] text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.10),0_5px_12px_rgba(20,83,45,0.10)] hover:border-emerald-900/22 hover:bg-white dark:border-emerald-200/14 dark:bg-[#18241e] dark:text-emerald-100 dark:shadow-none dark:hover:border-emerald-200/24 dark:hover:bg-[#1b2a22] sm:w-auto"
      >
        <span>
          {pending ? text.adminRunWorkerPending : text.adminRunWorker}
        </span>
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      </Button>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {pending ? text.adminRunWorkerPendingHint : text.adminRunWorkerHint}
      </p>
    </div>
  );
}

export function RunWorkerForm({ action, lang }: RunWorkerFormProps) {
  return (
    <form action={action}>
      <input type="hidden" name="lang" value={lang} />
      <SubmitButton lang={lang} />
    </form>
  );
}
