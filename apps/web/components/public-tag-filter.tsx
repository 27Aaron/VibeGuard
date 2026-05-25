"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { getInteractiveChipClassName } from "@/lib/interactive-chip";
import type { AppLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PublicTagFilterLink = {
  tag: string;
  count: number;
  href: string;
  active: boolean;
};

export function PublicTagFilter({
  visibleTags,
  overflowTags,
  allHref,
  activeTag,
  lang,
}: {
  visibleTags: PublicTagFilterLink[];
  overflowTags: PublicTagFilterLink[];
  allHref: string;
  activeTag: string;
  lang: AppLang;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const moreTagsRef = useRef<HTMLDivElement>(null);
  const labels =
    lang === "zh"
      ? {
          tag: "标签",
          all: "全部标签",
          more: "更多标签",
          search: "搜索标签",
          empty: "没有匹配标签",
        }
      : {
          tag: "Tags",
          all: "All tags",
          more: "More tags",
          search: "Search tags",
          empty: "No matching tags",
        };
  const normalizedQuery = query.trim().toLowerCase();
  const allTags = useMemo(
    () => [...visibleTags, ...overflowTags],
    [visibleTags, overflowTags],
  );
  const filteredPopoverTags = useMemo(() => {
    if (!normalizedQuery) {
      return allTags;
    }

    return allTags.filter((item) => item.tag.includes(normalizedQuery));
  }, [allTags, normalizedQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!moreTagsRef.current) {
        return;
      }

      if (!moreTagsRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (visibleTags.length === 0 && !activeTag) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-[1.2rem] border border-black/5 bg-white/62 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4.5 dark:shadow-none">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
        {labels.tag}
      </p>
      <div
        ref={moreTagsRef}
        className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
      >
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={allHref}
            className={cn(getInteractiveChipClassName(!activeTag), "shrink-0")}
          >
            {labels.all}
          </Link>
          {visibleTags.map((item) => (
            <TagLink key={item.tag} item={item} />
          ))}
        </div>
        {overflowTags.length > 0 ? (
          <div className="shrink-0">
            <button
              type="button"
              aria-controls={open ? popoverId : undefined}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className={cn(
                getInteractiveChipClassName(false),
                "cursor-pointer select-none",
              )}
            >
              {labels.more}
            </button>
            {open ? (
              <div
                id={popoverId}
                role="dialog"
                className="absolute -left-2 -right-2 top-full z-20 mt-4 rounded-[1.35rem] border border-black/5 bg-[#fcfcfa]/96 p-4 shadow-[0_24px_60px_-30px_rgba(10,10,10,0.5),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-xl dark:border-white/10 dark:bg-[#10161d]/96 dark:shadow-[0_26px_64px_-34px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={labels.search}
                  className="mb-3 h-10 w-full rounded-full border border-black/6 bg-[#fcfcfa] px-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 transition-colors focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/5.5 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-emerald-200/30 dark:focus:ring-emerald-200/10"
                />
                <div className="max-h-[24rem] overflow-y-auto pr-1">
                  {filteredPopoverTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {filteredPopoverTags.map((item) => (
                        <TagLink key={item.tag} item={item} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-zinc-500 dark:text-stone-400">
                      {labels.empty}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TagLink({ item }: { item: PublicTagFilterLink }) {
  return (
    <Link
      href={item.href}
      className={cn(getInteractiveChipClassName(item.active), "shrink-0")}
    >
      {item.tag}
      <span className="ml-1 text-zinc-400 dark:text-stone-500">
        {item.count}
      </span>
    </Link>
  );
}
