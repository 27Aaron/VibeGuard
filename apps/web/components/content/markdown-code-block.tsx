"use client";

import { isValidElement, type ReactNode } from "react";

import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

import { cn } from "@/lib/utils";

import {
  codeBlockLanguage,
  isMarkdownCodeBlock,
  normalizeCodeContent,
  type MarkdownElementNode,
  type VariantPalette,
} from "./markdown-shared";

export type MarkdownCodeChildProps = {
  className?: string;
  node?: MarkdownElementNode;
};

export function isMarkdownCodeChild(child: ReactNode) {
  if (!isValidElement<MarkdownCodeChildProps>(child)) {
    return false;
  }

  return (
    child.type === "code" ||
    child.props.node?.tagName === "code" ||
    child.props.className?.startsWith("language-")
  );
}

export type CodeBlockRendererProps = {
  className?: string;
  children: ReactNode;
  node?: MarkdownElementNode;
  palette: VariantPalette;
  copiedCodeBlock: string | null;
  resolvedTheme: "light" | "dark";
  copiedCodeLabel: string;
  copyCodeLabel: string;
  onCopy: (codeKey: string) => void;
};

export function CodeBlockRenderer({
  className: codeClassName,
  children,
  node,
  palette,
  copiedCodeBlock,
  resolvedTheme,
  copiedCodeLabel,
  copyCodeLabel,
  onCopy,
}: CodeBlockRendererProps) {
  const inline = !isMarkdownCodeBlock(codeClassName, node);

  if (inline) {
    return (
      <code
        className={cn(
          "max-w-full whitespace-normal rounded-md font-mono text-[0.92em] wrap-anywhere",
          palette.codeInline,
        )}
      >
        {children}
      </code>
    );
  }

  const language = codeBlockLanguage(codeClassName) || "text";
  const code = normalizeCodeContent(children);
  const codeKey = `${language}:${code}`;
  const copied = copiedCodeBlock === codeKey;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
    onCopy(codeKey);
  };

  return (
    <div
      className={cn(
        "my-6 overflow-hidden rounded-2xl border shadow-sm",
        palette.codeBlock,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-2 text-[11px] uppercase tracking-[0.24em]",
          palette.border,
          palette.caption,
        )}
      >
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? copiedCodeLabel : copyCodeLabel}
          title={copied ? copiedCodeLabel : copyCodeLabel}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full border text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60",
            copied
              ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-black/8 bg-white text-zinc-500 hover:border-emerald-900/18 hover:text-emerald-800 dark:border-white/10 dark:bg-white/5.5 dark:text-stone-400 dark:hover:border-emerald-200/20 dark:hover:text-emerald-300",
          )}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          <span className="sr-only">
            {copied ? copiedCodeLabel : copyCodeLabel}
          </span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={resolvedTheme === "dark" ? oneDark : oneLight}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "0.92rem",
          lineHeight: "1.75",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          },
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export type PreBlockRendererProps = {
  children: ReactNode;
  palette: VariantPalette;
};

export function PreBlockRenderer({ children, palette }: PreBlockRendererProps) {
  const hasCodeChild = Array.isArray(children)
    ? children.some(isMarkdownCodeChild)
    : isMarkdownCodeChild(children);

  return hasCodeChild ? (
    <>{children}</>
  ) : (
    <pre
      className={cn(
        "my-6 max-w-full whitespace-pre-wrap rounded-2xl px-4 py-3 font-mono text-[0.92em] leading-7 wrap-anywhere",
        palette.codeBlock,
      )}
    >
      {children}
    </pre>
  );
}
