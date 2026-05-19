export function getAdminShellClassName() {
  return "relative mx-auto flex min-h-svh w-full min-w-0 max-w-[1440px] flex-col gap-6 px-4 pb-8 pt-4 sm:px-6 lg:px-8"
}

export function getAdminBackgroundClassName() {
  return "relative min-h-svh overflow-hidden bg-[#f2f2f0] text-zinc-950 [background-image:linear-gradient(135deg,rgba(31,77,63,0.10),transparent_34%),linear-gradient(180deg,#faf9f3_0%,#f1f1ed_48%,#e7ece9_100%)] dark:bg-[#070b0f] dark:text-stone-100 dark:[background-image:linear-gradient(135deg,rgba(74,124,104,0.18),transparent_34%),linear-gradient(180deg,#070b0f_0%,#0e151a_52%,#111820_100%)]"
}

export function getAdminBackdropClassName() {
  return "pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-[0.13] dark:[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]"
}

export function getAdminSubtlePanelClassName() {
  return "rounded-[1.2rem] border border-black/5 bg-white/68 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none"
}

export function getAdminTableSurfaceClassName() {
  return "overflow-hidden rounded-[1.25rem] border border-black/5 bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
}

export function getAdminSelectClassName() {
  return "admin-select h-10 rounded-full border border-black/6 bg-[#fcfcfa] px-3 text-sm text-zinc-950 outline-none transition-colors hover:bg-white focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-100 dark:hover:bg-white/[0.08] dark:focus:border-emerald-200/30 dark:focus:ring-emerald-200/10"
}

export function getAdminFilterSelectClassName() {
  return "admin-select h-7 rounded-full border border-black/8 bg-white/70 pl-2.5 pr-7 text-xs font-medium text-zinc-700 outline-none transition-colors hover:border-emerald-900/20 hover:bg-white focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-200 dark:hover:border-emerald-200/20 dark:hover:bg-white/[0.08] dark:focus:border-emerald-200/30 dark:focus:ring-emerald-200/10"
}
