"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { Check, Copy, Expand } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import remarkGfm from "remark-gfm"

import type { AppLang } from "@/lib/i18n"
import { getUiText } from "@/lib/i18n"
import { renderMarkdownParagraph } from "@/lib/markdown-paragraphs"
import { cn } from "@/lib/utils"

type MarkdownRendererProps = {
  content: string
  sourceUrl?: string
  variant?: "public" | "admin"
  className?: string
  lang?: AppLang
}

const variantClasses = {
  public: {
    root: "text-slate-700 dark:text-stone-200",
    heading: "text-slate-950 dark:text-stone-50",
    body: "text-slate-600 dark:text-stone-300",
    border: "border-slate-200/80 dark:border-white/10",
    codeInline: "border border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/10 dark:text-amber-100",
    codeBlock: "border border-slate-200/80 bg-slate-50/90 text-slate-900 dark:border-white/10 dark:bg-[#0b0f14] dark:text-stone-100",
    quote: "border-l-2 border-slate-300 bg-slate-100/70 text-slate-600 dark:border-amber-200/40 dark:bg-white/[0.03] dark:text-stone-300",
    tableHead: "bg-slate-100/90 text-slate-900 dark:bg-white/[0.06] dark:text-stone-100",
    tableCell: "border-slate-200/80 dark:border-white/10",
    link: "text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-slate-700 hover:decoration-slate-500 dark:text-amber-200 dark:decoration-white/15 dark:hover:text-amber-100 dark:hover:decoration-amber-200/40",
    hr: "border-slate-200/80 dark:border-white/10",
    image: "border border-slate-200/80 bg-slate-100/70 dark:border-white/10 dark:bg-black/20",
    caption: "text-slate-500 dark:text-stone-400",
    imageHint:
      "bg-white/90 text-slate-900 ring-1 ring-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.12)] dark:bg-black/60 dark:text-stone-100 dark:ring-white/15 dark:shadow-none",
    lightboxBackdrop: "bg-slate-950/80 backdrop-blur-sm dark:bg-black/88",
  },
  admin: {
    root: "text-foreground",
    heading: "text-foreground",
    body: "text-muted-foreground",
    border: "border-border",
    codeInline: "border border-border bg-muted px-1.5 py-0.5 text-[0.92em] text-foreground",
    codeBlock: "border border-border bg-muted/60 text-foreground",
    quote: "border-l-2 border-border bg-muted/30 text-muted-foreground",
    tableHead: "bg-muted/50 text-foreground",
    tableCell: "border-border",
    link: "text-foreground underline decoration-border underline-offset-4 hover:text-foreground/80",
    hr: "border-border",
    image: "border border-border bg-muted/20",
    caption: "text-muted-foreground",
    imageHint:
      "bg-background/90 text-foreground ring-1 ring-border",
    lightboxBackdrop: "bg-background/88 backdrop-blur-sm",
  },
} as const

type LightboxImage = {
  src: string
  alt: string
}

function resolveAssetUrl(rawUrl: string, sourceUrl?: string) {
  if (!rawUrl) {
    return rawUrl
  }

  try {
    return new URL(rawUrl, sourceUrl).toString()
  } catch {
    return rawUrl
  }
}

function codeBlockLanguage(className?: string) {
  const match = className?.match(/language-([\w-]+)/)
  return match?.[1] ?? ""
}

function normalizeCodeContent(children: ReactNode) {
  return String(children).replace(/\n$/, "")
}

function renderImageCaption(alt: string | undefined, palette: (typeof variantClasses)[keyof typeof variantClasses]) {
  if (!alt?.trim()) {
    return null
  }

  return (
    <figcaption className={cn("mt-2 text-xs leading-6", palette.caption)}>
      {alt}
    </figcaption>
  )
}

export function MarkdownRenderer({
  content,
  sourceUrl,
  variant = "public",
  className,
  lang = "zh",
}: MarkdownRendererProps) {
  const palette = variantClasses[variant]
  const text = getUiText(lang)
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null)
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null)
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark")
  const lightboxTimerRef = useRef<number | null>(null)
  const lightboxFrameRef = useRef<number | null>(null)
  const copiedCodeTimerRef = useRef<number | null>(null)

  const closeLightbox = () => {
    setLightboxVisible(false)

    if (lightboxTimerRef.current) {
      window.clearTimeout(lightboxTimerRef.current)
    }

    lightboxTimerRef.current = window.setTimeout(() => {
      setLightboxImage(null)
      lightboxTimerRef.current = null
    }, 280)
  }

  useEffect(() => {
    if (!lightboxImage) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox()
      }
    }

    document.body.style.overflow = "hidden"
    lightboxFrameRef.current = window.requestAnimationFrame(() => {
      setLightboxVisible(true)
      lightboxFrameRef.current = null
    })
    window.addEventListener("keydown", handleEscape)

    return () => {
      if (lightboxFrameRef.current) {
        window.cancelAnimationFrame(lightboxFrameRef.current)
        lightboxFrameRef.current = null
      }
      if (lightboxTimerRef.current) {
        window.clearTimeout(lightboxTimerRef.current)
        lightboxTimerRef.current = null
      }
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleEscape)
    }
  }, [lightboxImage])

  useEffect(() => {
    const root = document.documentElement
    const syncTheme = () => {
      setResolvedTheme(root.classList.contains("dark") ? "dark" : "light")
    }

    syncTheme()

    const observer = new MutationObserver(syncTheme)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      if (copiedCodeTimerRef.current) {
        window.clearTimeout(copiedCodeTimerRef.current)
      }
    }
  }, [])

  return (
    <>
      <div
        className={cn(
          "markdown-body max-w-none text-[15px] leading-8",
          palette.root,
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            h1: ({ children }) => (
              <h1 className={cn("mt-8 mb-4 text-3xl font-semibold leading-tight first:mt-0", palette.heading)}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={cn("mt-8 mb-4 text-2xl font-semibold leading-tight", palette.heading)}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={cn("mt-7 mb-3 text-xl font-semibold leading-tight", palette.heading)}>
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className={cn("mt-6 mb-3 text-lg font-semibold leading-tight", palette.heading)}>
                {children}
              </h4>
            ),
            p: ({ node, children }) =>
              renderMarkdownParagraph(children, cn("my-4 leading-8", palette.body), node),
            a: ({ href, children }) => (
              <a
                href={resolveAssetUrl(href ?? "", sourceUrl)}
                target="_blank"
                rel="noreferrer"
                className={palette.link}
              >
                {children}
              </a>
            ),
            ul: ({ children }) => (
              <ul className={cn("my-4 list-disc space-y-2 pl-6", palette.body)}>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className={cn("my-4 list-decimal space-y-2 pl-6", palette.body)}>{children}</ol>
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
                <table className={cn("min-w-full border-collapse text-sm", palette.border)}>
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className={cn("text-left", palette.tableHead)}>{children}</thead>
            ),
            th: ({ children }) => (
              <th className={cn("border px-3 py-2 font-medium", palette.tableCell)}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className={cn("border px-3 py-2 align-top", palette.tableCell)}>
                {children}
              </td>
            ),
            code: ({ className: codeClassName, children, ...props }) => {
              const inline = !codeClassName

              if (inline) {
                return (
                  <code className={cn("rounded-md font-mono text-[0.92em]", palette.codeInline)} {...props}>
                    {children}
                  </code>
                )
              }

              const language = codeBlockLanguage(codeClassName) || "text"
              const code = normalizeCodeContent(children)
              const codeKey = `${language}:${code}`
              const copied = copiedCodeBlock === codeKey

              const handleCopy = async () => {
                await navigator.clipboard.writeText(code)
                setCopiedCodeBlock(codeKey)

                if (copiedCodeTimerRef.current) {
                  window.clearTimeout(copiedCodeTimerRef.current)
                }

                copiedCodeTimerRef.current = window.setTimeout(() => {
                  setCopiedCodeBlock((current) => (current === codeKey ? null : current))
                  copiedCodeTimerRef.current = null
                }, 1600)
              }

              return (
                <div className={cn("my-6 overflow-hidden rounded-2xl border shadow-sm", palette.codeBlock)}>
                  <div className={cn("flex items-center justify-between border-b px-4 py-2 text-[11px] uppercase tracking-[0.24em]", palette.border, palette.caption)}>
                    <span>{language}</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      aria-label={copied ? text.copiedCode : text.copyCode}
                      title={copied ? text.copiedCode : text.copyCode}
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full border text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60",
                        copied
                          ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-stone-400 dark:hover:border-white/20 dark:hover:text-stone-100",
                      )}
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span className="sr-only">{copied ? text.copiedCode : text.copyCode}</span>
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
              )
            },
            pre: ({ children }) => <>{children}</>,
            img: ({ src, alt }) => {
              const resolvedSrc = resolveAssetUrl(typeof src === "string" ? src : "", sourceUrl)

              return (
                <figure className="group my-8">
                  <button
                    type="button"
                    onClick={() => setLightboxImage({ src: resolvedSrc, alt: alt ?? "" })}
                    className="relative block w-full overflow-hidden rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvedSrc}
                      alt={alt ?? ""}
                      loading="lazy"
                      className={cn(
                        "w-full rounded-2xl object-contain shadow-sm transition duration-300 group-hover:scale-[1.01]",
                        palette.image,
                      )}
                    />
                    <span
                      className={cn(
                        "pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium opacity-0 transition group-hover:opacity-100",
                        palette.imageHint,
                      )}
                    >
                      <Expand className="size-3.5" />
                      {lang === "zh" ? "点击放大" : "Click to zoom"}
                    </span>
                  </button>
                  {renderImageCaption(alt, palette)}
                </figure>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {lightboxImage ? (
          <div
            className={cn(
              "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-220 md:p-8",
              palette.lightboxBackdrop,
              lightboxVisible ? "opacity-100" : "opacity-0",
            )}
            role="dialog"
            aria-modal="true"
            onClick={closeLightbox}
          >
            <div
              className={cn(
                "inline-flex max-h-[94vh] max-w-[96vw] items-center justify-center transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)]",
                lightboxVisible ? "scale-100 opacity-100" : "scale-[0.994] opacity-0",
              )}
              onClick={(event) => event.stopPropagation()}
            >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              onClick={closeLightbox}
              className="max-h-[94vh] w-[min(96vw,1600px)] max-w-[96vw] cursor-zoom-out rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </>
  )
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
        content={content}
        sourceUrl={sourceUrl}
        variant={variant}
        lang={lang}
        className={cn(
          "text-base leading-7 [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0",
          className,
        )}
      />
  )
}
