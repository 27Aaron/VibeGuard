"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CustomSelectProps = {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const DROPDOWN_MAX_H = 280;
const DROPDOWN_GAP = 8;

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setDropUp(
      spaceBelow < DROPDOWN_MAX_H + DROPDOWN_GAP && spaceAbove > spaceBelow,
    );
  }, [open]);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    // 下拉菜单打开时，将初始激活项设置为当前已选中的选项，如果没有选中则默认第一项
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        // 基础焦点陷阱：按下 Tab 时关闭下拉菜单，让焦点自然返回到页面的 Tab 序列中
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < options.length) {
          onChange(options[activeIndex].value);
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, options, activeIndex, onChange]);

  // 将当前激活的选项滚动到可视区域内，确保键盘导航时不会出现选中项不可见的情况
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={
          open && activeIndex >= 0 ? `select-option-${activeIndex}` : undefined
        }
        className="flex h-11 w-full items-center justify-between rounded-full border border-black/6 bg-[#fcfcfa] px-4 text-sm text-zinc-950 outline-none transition-colors hover:border-black/10 focus-visible:border-emerald-700/30 focus-visible:ring-2 focus-visible:ring-emerald-700/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5.5 dark:text-stone-100 dark:hover:border-white/15 dark:focus-visible:border-emerald-200/30 dark:focus-visible:ring-emerald-200/10"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? ""}</span>
        <ChevronDown className="ml-2 size-4 shrink-0 text-zinc-500 dark:text-stone-400" />
      </button>
      {open ? (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 z-20 flex max-h-[280px] w-full flex-col gap-1.5 overflow-y-auto rounded-[1.1rem] border border-black/8 bg-[#fcfcfa] p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-[#1b2028]",
            dropUp ? "bottom-[calc(100%+0.45rem)]" : "top-[calc(100%+0.45rem)]",
          )}
        >
          {options.map((option, idx) => {
            const active = option.value === value;
            const isHighlighted = idx === activeIndex;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[idx] = el;
                }}
                id={`select-option-${idx}`}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full items-center rounded-[0.85rem] px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-black/[0.045] text-zinc-950 dark:bg-white/[0.08] dark:text-stone-50"
                    : isHighlighted
                      ? "bg-black/[0.03] text-zinc-950 dark:bg-white/5 dark:text-stone-50"
                      : "text-zinc-700 hover:bg-black/[0.03] dark:text-stone-200 dark:hover:bg-white/[0.05]",
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
