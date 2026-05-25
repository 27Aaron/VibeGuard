export function getShellClassName() {
  return "relative mx-auto flex min-h-svh w-full min-w-0 max-w-[1440px] flex-col gap-6 px-4 pb-8 pt-4 sm:px-6 lg:px-8";
}

export function getBackgroundClassName() {
  return "relative min-h-svh overflow-hidden bg-[#f2f2f0] text-zinc-950 [background-image:linear-gradient(135deg,rgba(31,77,63,0.10),transparent_34%),linear-gradient(180deg,#faf9f3_0%,#f1f1ed_48%,#e7ece9_100%)] dark:bg-[#070b0f] dark:text-stone-100 dark:[background-image:linear-gradient(135deg,rgba(74,124,104,0.18),transparent_34%),linear-gradient(180deg,#070b0f_0%,#0e151a_52%,#111820_100%)]";
}

export function getBackdropClassName() {
  return "pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-[0.13] dark:[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)]";
}

export function getSubtlePanelClassName() {
  return "rounded-[1.2rem] border border-black/5 bg-white/68 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4.5 dark:shadow-none";
}

export function getTableSurfaceClassName() {
  return "overflow-hidden rounded-[1.25rem] border border-black/5 bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4 dark:shadow-none";
}

export function getSelectClassName() {
  return "admin-select h-10 rounded-full border border-black/6 bg-[#fcfcfa] px-3 text-sm text-zinc-950 outline-none transition-colors hover:bg-white focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/5.5 dark:text-stone-100 dark:hover:bg-white/[0.08] dark:focus:border-emerald-200/30 dark:focus:ring-emerald-200/10";
}

export function getFilterSelectClassName() {
  return "admin-select h-7 rounded-full border border-black/8 bg-white/70 pl-2.5 pr-7 text-xs font-medium text-zinc-700 outline-none transition-colors hover:border-emerald-900/20 hover:bg-white focus:border-emerald-700/30 focus:ring-2 focus:ring-emerald-700/10 dark:border-white/10 dark:bg-white/5.5 dark:text-stone-200 dark:hover:border-emerald-200/20 dark:hover:bg-white/[0.08] dark:focus:border-emerald-200/30 dark:focus:ring-emerald-200/10";
}

export function getSectionOuterClassName() {
  return "rounded-[2rem] border border-black/5 bg-white/48 p-1.5 shadow-[0_22px_62px_-42px_rgba(10,10,10,0.42),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4.5 dark:shadow-[0_24px_70px_-48px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]";
}

export function getSectionInnerClassName() {
  return "rounded-[1.55rem] bg-[#fcfcfa]/92 p-4 shadow-[inset_0_0_0_1px_rgba(10,10,10,0.04),inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-5 dark:bg-[#10161d]/92 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.04)]";
}

export function getCardSurfaceClassName() {
  return "rounded-[1.65rem] border border-black/5 bg-white/50 p-1.5 shadow-[0_20px_44px_-30px_rgba(10,10,10,0.34),inset_0_1px_0_rgba(255,255,255,0.72)] transition-[border-color,transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:border-emerald-900/15 hover:shadow-[0_28px_64px_-34px_rgba(10,10,10,0.42),inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:border-emerald-200/25";
}
