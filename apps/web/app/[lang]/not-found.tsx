import { AutoRedirectHome } from "@/components/auto-redirect-home"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getShellClassName,
} from "@/lib/layout-tokens"

export default function NotFound() {
  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />
      <div className={getShellClassName()}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
          <p className="text-6xl font-bold tracking-tight text-zinc-200 dark:text-white/10">
            404
          </p>
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-stone-50">
            页面未找到
          </h1>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-stone-400">
            你访问的页面不存在或已被移除，3 秒后自动返回首页。
          </p>
          <AutoRedirectHome lang="zh" />
        </div>
      </div>
    </main>
  )
}
