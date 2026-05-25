"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { AppLang } from "@/lib/i18n";
import { getUiText } from "@/lib/i18n";
import { normalizeSummaryMarkdownHeadings } from "@/lib/markdown-summary";
import { resolveMarkdownLinkUrl } from "@/lib/markdown-url";
import { renderMarkdownParagraph } from "@/lib/markdown-paragraphs";
import { cn } from "@/lib/utils";

import {
  CodeBlockRenderer,
  PreBlockRenderer,
} from "./markdown-code-block";
import {
  ImageRenderer,
  LightboxOverlay,
  useLightbox,
} from "./markdown-image";
import {
  type MarkdownRendererProps,
  variantClasses,
} from "./markdown-shared";

function normalizeMarkdownEmphasis(raw: string): string {
  // CJK/全角标点（U+3000-U+303F, U+FF00-U+FFEF）紧邻闭合强调标记（* / ** / ***）
  // 会破坏 Commonmark 的 right-flanking delimiter 检测规则，导致加粗/斜体无法正确渲染。
  // 通过在标点和星号之间插入零宽空格（U+200B）来修复此问题。
  // 示例：**text：**  →  修复后可以正确渲染为粗体。
  return raw.replace(
    /([　-〿＀-￯])(\*{1,3})/g,
    (_, punct: string, stars: string) => punct + "​" + stars,
  );
}

export function MarkdownRenderer({
  content,
  sourceUrl,
  variant = "public",
  className,
  lang = "zh",
}: MarkdownRendererProps) {
  const palette = variantClasses[variant];
  const text = getUiText(lang);
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const copiedCodeTimerRef = useRef<number | null>(null);

  const {
    lightboxImage,
    lightboxVisible,
    closeLightbox,
    openLightbox,
  } = useLightbox();

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      setResolvedTheme(root.classList.contains("dark") ? "dark" : "light");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (copiedCodeTimerRef.current) {
        window.clearTimeout(copiedCodeTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        className={cn(
          "markdown-body max-w-none text-sm leading-7",
          palette.root,
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={useMemo(
            () => ({
              h1: ({ children }) => (
                <h1
                  className={cn(
                    "mt-8 mb-4 text-3xl font-semibold leading-tight first:mt-0",
                    palette.heading,
                  )}
                >
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2
                  className={cn(
                    "mt-8 mb-4 text-2xl font-semibold leading-tight",
                    palette.heading,
                  )}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  className={cn(
                    "mt-7 mb-3 text-xl font-semibold leading-tight",
                    palette.heading,
                  )}
                >
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4
                  className={cn(
                    "mt-6 mb-3 text-lg font-semibold leading-tight",
                    palette.heading,
                  )}
                >
                  {children}
                </h4>
              ),
              p: ({ node, children }) =>
                renderMarkdownParagraph(
                  children,
                  cn("my-4 leading-7", palette.body),
                  node,
                ),
              a: ({ href, children }) => (
                <a
                  href={resolveMarkdownLinkUrl(href ?? "", sourceUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className={palette.link}
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => (
                <ul
                  className={cn("my-4 list-disc space-y-2 pl-6", palette.body)}
                >
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol
                  className={cn(
                    "my-4 list-decimal space-y-2 pl-6",
                    palette.body,
                  )}
                >
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="pl-1">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote
                  className={cn(
                    "my-6 rounded-r-xl px-4 py-3 italic",
                    palette.quote,
                  )}
                >
                  {children}
                </blockquote>
              ),
              hr: () => <hr className={cn("my-8 border-t", palette.hr)} />,
              table: ({ children }) => (
                <div className="my-6 overflow-x-auto">
                  <table
                    className={cn(
                      "min-w-full border-collapse text-sm",
                      palette.border,
                    )}
                  >
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className={cn("text-left", palette.tableHead)}>
                  {children}
                </thead>
              ),
              th: ({ children }) => (
                <th
                  className={cn(
                    "border px-3 py-2 font-medium",
                    palette.tableCell,
                  )}
                >
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td
                  className={cn(
                    "border px-3 py-2 align-top",
                    palette.tableCell,
                  )}
                >
                  {children}
                </td>
              ),
              code: ({ className: codeClassName, children, node, ...props }) => (
                <CodeBlockRenderer
                  className={codeClassName}
                  node={node}
                  palette={palette}
                  copiedCodeBlock={copiedCodeBlock}
                  resolvedTheme={resolvedTheme}
                  copiedCodeLabel={text.copiedCode}
                  copyCodeLabel={text.copyCode}
                  onCopy={(codeKey) => {
                    setCopiedCodeBlock(codeKey);

                    if (copiedCodeTimerRef.current) {
                      window.clearTimeout(copiedCodeTimerRef.current);
                    }

                    copiedCodeTimerRef.current = window.setTimeout(() => {
                      setCopiedCodeBlock((current) =>
                        current === codeKey ? null : current,
                      );
                      copiedCodeTimerRef.current = null;
                    }, 1600);
                  }}
                >
                  {children}
                </CodeBlockRenderer>
              ),
              pre: ({ children }) => (
                <PreBlockRenderer palette={palette}>
                  {children}
                </PreBlockRenderer>
              ),
              img: ({ src, alt }) => (
                <ImageRenderer
                  src={src}
                  alt={alt}
                  sourceUrl={sourceUrl}
                  lang={lang}
                  palette={palette}
                  onLightboxOpen={openLightbox}
                />
              ),
            }),
            [
              palette,
              lang,
              sourceUrl,
              copiedCodeBlock,
              resolvedTheme,
              text.copiedCode,
              text.copyCode,
              openLightbox,
            ],
          )}
        >
          {normalizeMarkdownEmphasis(content)}
        </ReactMarkdown>
      </div>

      {lightboxImage ? (
        <LightboxOverlay
          lightboxImage={lightboxImage}
          lightboxVisible={lightboxVisible}
          palette={palette}
          onClose={closeLightbox}
        />
      ) : null}
    </>
  );
}

export function MarkdownSummary({
  content,
  sourceUrl,
  variant = "public",
  className,
  lang = "zh",
}: MarkdownRendererProps) {
  return (
    <MarkdownRenderer
      content={normalizeSummaryMarkdownHeadings(content)}
      sourceUrl={sourceUrl}
      variant={variant}
      lang={lang}
      className={cn(
        "text-base leading-7 [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0",
        className,
      )}
    />
  );
}
