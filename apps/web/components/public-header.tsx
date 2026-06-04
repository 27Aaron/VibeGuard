import Link from "next/link";
import { Radio, ShieldCheck } from "lucide-react";

import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppLang } from "@/lib/i18n";

type PublicHeaderProps = {
  homeHref: string;
  currentLang: AppLang;
};

export function PublicHeader({
  homeHref,
  currentLang,
}: PublicHeaderProps) {
  return (
    <header className="sticky top-2 z-40 sm:top-3">
      <div className="w-full min-w-0 rounded-[1.5rem] border border-black/5 bg-white/45 p-1 shadow-[0_20px_55px_-34px_rgba(10,10,10,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-1.5 md:rounded-full dark:border-white/10 dark:bg-white/5.5 dark:shadow-[0_22px_60px_-36px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[1.15rem] bg-white/58 px-2.5 py-2 sm:gap-3 sm:rounded-[1.55rem] sm:px-3 sm:py-3 md:rounded-full md:py-2 dark:bg-[#0c1218]/70">
          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-2 rounded-full pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 sm:gap-2.5 sm:pr-2"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.06)] sm:size-8 dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <ShieldCheck className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="block text-[0.82rem] font-semibold leading-none tracking-normal sm:text-sm">
                VibeGuard
              </span>
              <span className="flex items-center gap-1 text-[0.5rem] font-medium uppercase leading-none tracking-[0.12em] sm:text-[0.58rem] text-zinc-500 dark:text-stone-400">
                <Radio className="size-2.5 text-emerald-700 dark:text-emerald-300" />
                Live feed
              </span>
            </span>
          </Link>

          <div className="flex items-center justify-end gap-1 justify-self-end sm:gap-1.5">
            <ThemeToggle />
            <LanguageToggle currentLang={currentLang} />
          </div>
        </div>
      </div>
    </header>
  );
}
