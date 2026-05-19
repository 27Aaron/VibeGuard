export default function AdminLoading() {
  return (
    <>
      <section className="rounded-[1.5rem] border border-black/5 bg-white/45 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
          <div className="h-7 w-28 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
        </div>
      </section>
      <div className="flex flex-col gap-4">
        <div className="h-48 animate-pulse rounded-[1.5rem] border border-black/5 bg-white/45 dark:border-white/10 dark:bg-white/[0.04]" />
        <div className="h-64 animate-pulse rounded-[1.5rem] border border-black/5 bg-white/45 dark:border-white/10 dark:bg-white/[0.04]" />
      </div>
    </>
  )
}
