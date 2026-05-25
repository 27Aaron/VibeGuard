import type { AppLang } from "@/lib/i18n";

export type MarkdownRendererProps = {
  content: string;
  sourceUrl?: string;
  variant?: "public" | "admin";
  className?: string;
  lang?: AppLang;
};

export const variantClasses = {
  public: {
    root: "text-zinc-800 dark:text-stone-200",
    heading: "text-zinc-950 dark:text-stone-50",
    body: "text-zinc-600 dark:text-stone-300",
    border: "border-black/5 dark:border-white/10",
    codeInline:
      "border border-black/8 bg-[#eef2f7] text-zinc-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-100",
    codeBlock:
      "border border-black/5 bg-white/72 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-[#0b1117] dark:text-stone-100 dark:shadow-none",
    quote:
      "border-l-2 border-emerald-900/20 bg-[#f7fbf8] text-zinc-600 dark:border-emerald-200/20 dark:bg-[#121b17] dark:text-stone-300",
    tableHead:
      "bg-white/56 text-zinc-950 dark:bg-white/4.5 dark:text-stone-100",
    tableCell: "border-black/5 dark:border-white/10",
    link: "text-emerald-800 underline decoration-emerald-900/20 underline-offset-4 hover:text-emerald-950 hover:decoration-emerald-900/40 dark:text-emerald-300 dark:decoration-emerald-200/20 dark:hover:text-emerald-100 dark:hover:decoration-emerald-200/40",
    hr: "border-black/5 dark:border-white/10",
    image:
      "border border-black/5 bg-white/58 dark:border-white/10 dark:bg-white/4",
    caption: "text-zinc-500 dark:text-stone-400",
    imageHint:
      "bg-white/90 text-zinc-900 ring-1 ring-black/5 shadow-[0_12px_30px_rgba(15,23,42,0.12)] dark:bg-black/60 dark:text-stone-100 dark:ring-white/15 dark:shadow-none",
    lightboxBackdrop: "bg-zinc-950/80 backdrop-blur-sm dark:bg-black/88",
  },
  admin: {
    root: "text-zinc-800 dark:text-stone-200",
    heading: "text-zinc-950 dark:text-stone-50",
    body: "text-zinc-600 dark:text-stone-300",
    border: "border-black/5 dark:border-white/10",
    codeInline:
      "border border-black/8 bg-[#eef2f7] px-1.5 py-0.5 text-[0.92em] text-zinc-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-100",
    codeBlock:
      "border border-black/5 bg-white/68 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-[#0b1117] dark:text-stone-100 dark:shadow-none",
    quote:
      "border-l-2 border-emerald-900/20 bg-[#f7fbf8] text-zinc-600 dark:border-emerald-200/20 dark:bg-[#121b17] dark:text-stone-300",
    tableHead:
      "bg-white/56 text-zinc-950 dark:bg-white/4.5 dark:text-stone-100",
    tableCell: "border-black/5 dark:border-white/10",
    link: "text-emerald-800 underline decoration-emerald-900/20 underline-offset-4 hover:text-emerald-950 hover:decoration-emerald-900/40 dark:text-emerald-300 dark:decoration-emerald-200/20 dark:hover:text-emerald-100 dark:hover:decoration-emerald-200/40",
    hr: "border-black/5 dark:border-white/10",
    image:
      "border border-black/5 bg-white/58 dark:border-white/10 dark:bg-white/4",
    caption: "text-zinc-500 dark:text-stone-400",
    imageHint:
      "bg-white/90 text-zinc-900 ring-1 ring-black/5 shadow-[0_12px_30px_rgba(15,23,42,0.12)] dark:bg-black/60 dark:text-stone-100 dark:ring-white/15 dark:shadow-none",
    lightboxBackdrop: "bg-background/88 backdrop-blur-sm",
  },
} as const;

export type VariantPalette =
  (typeof variantClasses)[keyof typeof variantClasses];

export type MarkdownElementNode = {
  tagName?: string;
  position?: {
    start?: { line?: number };
    end?: { line?: number };
  };
};

export function codeBlockLanguage(className?: string) {
  const match = className?.match(/language-([\w-]+)/);
  return match?.[1] ?? "";
}

export function isMarkdownCodeBlock(
  className: string | undefined,
  node?: MarkdownElementNode,
) {
  if (className) {
    return true;
  }

  const startLine = node?.position?.start?.line;
  const endLine = node?.position?.end?.line;
  return (
    typeof startLine === "number" &&
    typeof endLine === "number" &&
    endLine > startLine
  );
}

export function normalizeCodeContent(children: import("react").ReactNode) {
  return String(children).replace(/\n$/, "");
}
