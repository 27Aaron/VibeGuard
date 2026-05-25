import type { AppLang } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  getBackgroundClassName,
  getBackdropClassName,
  getShellClassName,
  getSectionOuterClassName,
  getSectionInnerClassName,
} from "@/lib/layout-tokens";
import { RedirectCountdown } from "@/components/redirect-countdown";
import { Radio, ShieldAlert } from "lucide-react";

type NotFoundContentProps = {
  lang: AppLang;
};

export function NotFoundContent({ lang }: NotFoundContentProps) {
  const isZh = lang === "zh";

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />
      <div className={getShellClassName()}>
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className={cn(getSectionOuterClassName(), "w-full max-w-lg")}>
            <div className={cn(getSectionInnerClassName(), "p-6 sm:p-7")}>
              <div className="flex flex-col items-center gap-6 py-8 text-center">
                <div className="relative">
                  <div className="flex size-16 items-center justify-center rounded-2xl border border-emerald-900/12 bg-[#e9f2ec] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.06)] dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <ShieldAlert className="size-7 text-emerald-800 dark:text-emerald-300" />
                  </div>
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-red-900/15 bg-[#fef2f2] text-[10px] font-bold text-red-700 shadow-sm dark:border-red-200/15 dark:bg-red-950/40 dark:text-red-300">
                    !
                  </span>
                </div>

                <div className="inline-flex h-7 items-center gap-2 rounded-full border border-black/6 bg-white/72 px-3 text-xs font-medium text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/5.5 dark:text-stone-300 dark:shadow-none">
                  <Radio className="size-3 text-emerald-700 dark:text-emerald-300" />
                  {isZh ? "路径信号丢失" : "Route signal lost"}
                </div>

                <p className="bg-gradient-to-b from-zinc-300 to-zinc-500 bg-clip-text text-7xl font-black tracking-normal text-transparent dark:from-stone-100/25 dark:to-stone-100/5">
                  404
                </p>

                <div className="flex flex-col items-center gap-2">
                  <h1 className="text-xl font-semibold text-zinc-950 dark:text-stone-50">
                    {isZh ? "页面没有找到" : "Page not found"}
                  </h1>
                  <p className="max-w-xs text-sm leading-relaxed text-zinc-500 dark:text-stone-400">
                    {isZh
                      ? "这条线索不存在，或已经被移动到新的路径。"
                      : "This signal does not exist, or it has moved to a different path."}
                  </p>
                </div>

                <RedirectCountdown lang={lang} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
