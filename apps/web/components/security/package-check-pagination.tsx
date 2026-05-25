"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppLang } from "@/lib/i18n";
import { getUiText } from "@/lib/i18n";

type PaginationControlsProps = {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  lang: AppLang;
};

export function PaginationControls({
  currentPage,
  pageCount,
  onPageChange,
  lang,
}: PaginationControlsProps) {
  const copy = getUiText(lang);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-zinc-500 dark:text-stone-400">
      <span>
        {copy.publicCheckPageStatus(currentPage, pageCount)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-full"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        aria-label={copy.pagePrev}
        title={copy.pagePrev}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-full"
        disabled={currentPage === pageCount}
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        aria-label={copy.pageNext}
        title={copy.pageNext}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
