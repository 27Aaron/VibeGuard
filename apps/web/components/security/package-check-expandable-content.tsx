"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppLang } from "@/lib/i18n";
import { buildSummaryPreviewText } from "@/lib/summary-preview";

const MarkdownRenderer = dynamic(
  () =>
    import("@/components/content/markdown-renderer").then(
      (m) => m.MarkdownRenderer,
    ),
  { ssr: false },
);

type ExpandableMarkdownBlockProps = {
  label: string;
  content: string;
  lang: AppLang;
  expandLabel: string;
  collapseLabel: string;
};

export function ExpandableMarkdownBlock({
  label,
  content,
  lang,
  expandLabel,
  collapseLabel,
}: ExpandableMarkdownBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const previewText = buildSummaryPreviewText(content);

  useEffect(() => {
    const measureElement = measureRef.current;

    if (!measureElement) {
      return;
    }

    setCanExpand(false);

    const measureOverflow = () => {
      const styles = window.getComputedStyle(measureElement);
      const lineHeight = Number.parseFloat(styles.lineHeight);
      const collapsedHeight =
        (Number.isFinite(lineHeight) ? lineHeight : 24) * 2;
      const nextCanExpand = measureElement.scrollHeight > collapsedHeight + 1;
      setCanExpand(nextCanExpand);
    };

    measureOverflow();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverflow);
      return () => window.removeEventListener("resize", measureOverflow);
    }

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(measureElement);
    window.addEventListener("resize", measureOverflow);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureOverflow);
    };
  }, [previewText]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
          {label}
        </p>
        {canExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-zinc-500 hover:text-zinc-950 dark:text-stone-400 dark:hover:text-stone-50"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            {expanded ? collapseLabel : expandLabel}
          </Button>
        ) : null}
      </div>
      <div className="relative rounded-2xl border border-black/6 bg-white/65 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none">
        {expanded ? (
          <MarkdownRenderer
            content={content}
            variant="public"
            lang={lang}
            className="text-sm leading-6 text-zinc-600 dark:text-stone-300 [&_p]:text-inherit [&_ul]:text-inherit [&_ol]:text-inherit [&_.markdown-body]:text-inherit"
          />
        ) : (
          <div className="line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-stone-300">
            {previewText}
          </div>
        )}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 top-3 text-sm leading-6 text-zinc-600 dark:text-stone-300"
          style={{ visibility: "hidden" }}
        >
          {previewText}
        </div>
      </div>
    </div>
  );
}
