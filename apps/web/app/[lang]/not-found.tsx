import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getShellClassName,
  getSectionOuterClassName,
  getSectionInnerClassName,
} from "@/lib/layout-tokens"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />
      <div className={getShellClassName()}>
        <section className={getSectionOuterClassName()}>
          <div className={cn("flex flex-col items-center gap-6 px-6 py-16 text-center", getSectionInnerClassName())}>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-stone-400">
              404
            </p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-stone-50">
              页面未找到
            </h1>
            <p className="max-w-md text-sm text-zinc-600 dark:text-stone-300">
              你访问的页面不存在或已被移除。
            </p>
            <Link
              href="/zh"
              className={buttonVariants({ variant: "outline" })}
            >
              返回首页
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
