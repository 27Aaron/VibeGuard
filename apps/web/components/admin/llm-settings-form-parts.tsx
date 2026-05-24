"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { FormActionResult } from "@/lib/action-result";
import type { AppLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackMessage({ state }: { state: FormActionResult }) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <div
      className={`rounded-[1.15rem] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:shadow-none ${
        state.status === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive dark:bg-destructive/10"
          : "border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
      }`}
      aria-live="polite"
    >
      {state.message}
    </div>
  );
}

export function CollapsiblePromptField({
  id,
  name,
  label,
  value,
  onChange,
  lang,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  lang: AppLang;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-[1.15rem] border border-black/5 bg-white/58 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronDown className="size-3.5" />
              {lang === "zh" ? "收起" : "Collapse"}
            </>
          ) : (
            <>
              <ChevronRight className="size-3.5" />
              {lang === "zh" ? "展开" : "Expand"}
            </>
          )}
        </Button>
      </div>
      {expanded ? (
        <Textarea
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <>
          <input type="hidden" name={name} value={value} />
          <div
            className="line-clamp-2 cursor-pointer rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground leading-relaxed hover:bg-muted/50"
            onClick={() => setExpanded(true)}
          >
            {value || (lang === "zh" ? "未配置" : "Not configured")}
          </div>
        </>
      )}
    </div>
  );
}

export function SubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
