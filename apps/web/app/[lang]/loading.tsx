export default function Loading() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-[#f2f2f0] [background-image:linear-gradient(135deg,rgba(31,77,63,0.10),transparent_34%),linear-gradient(180deg,#faf9f3_0%,#f1f1ed_48%,#e7ece9_100%)] dark:bg-[#070b0f] dark:[background-image:linear-gradient(135deg,rgba(74,124,104,0.18),transparent 34%),linear-gradient(180deg,#070b0f_0%,#0e151a_52%,#111820_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-[0.13] dark:[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
      <div className="relative mx-auto flex min-h-svh w-full min-w-0 max-w-[1440px] flex-col gap-6 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <div className="h-14 animate-pulse rounded-[2rem] border border-black/5 bg-white/45 dark:border-white/10 dark:bg-white/[0.055]" />
        <div className="rounded-[2rem] border border-black/5 bg-white/48 p-1.5 dark:border-white/10 dark:bg-white/[0.045]">
          <div className="rounded-[1.55rem] bg-[#fcfcfa]/92 p-4 dark:bg-[#10161d]/92">
            <div className="flex flex-col gap-3">
              <div className="h-5 w-32 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
              <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
              <div className="mt-2 h-11 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
            </div>
          </div>
        </div>
        <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-[1.65rem] border border-black/5 bg-white/50 dark:border-white/10 dark:bg-white/[0.05]"
            />
          ))}
        </div>
      </div>
    </main>
  )
}
