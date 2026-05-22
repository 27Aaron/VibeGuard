"use client"

import { type FormEvent, useEffect, useRef, useState } from "react"

import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared"
import { ChevronDown, ChevronRight, Search } from "lucide-react"

import {
  MarkdownRenderer,
  MarkdownSummary,
} from "@/components/content/markdown-renderer"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAdminSelectClassName, getAdminSubtlePanelClassName } from "@/lib/admin-layout"
import type { AppLang } from "@/lib/i18n"
import { getUiText } from "@/lib/i18n"
import {
  buildSecurityCheckRequestBody,
  formatAffectedRanges,
  parseSecurityCheckPayload,
  buildSecurityWorkbenchResultState,
  getSecurityFindingTone,
  type SecurityFinding,
} from "@/lib/security-workbench"
import { buildSummaryPreviewText } from "@/lib/summary-preview"
import { cn } from "@/lib/utils"

type PackageCheckWorkbenchProps = {
  lang: AppLang
}

type PackageCheckWorkbenchResult = ReturnType<typeof buildSecurityWorkbenchResultState>

type ExpandableMarkdownBlockProps = {
  label: string
  content: string
  lang: AppLang
  expandLabel: string
  collapseLabel: string
}

function ecosystemLabel(ecosystem: SecurityPackageEcosystem) {
  switch (ecosystem) {
    case "pypi":
      return "PyPI"
    case "go":
      return "Go"
    case "crates-io":
      return "crates.io"
    default:
      return ecosystem
  }
}

function toneBadgeVariant(finding: SecurityFinding) {
  switch (getSecurityFindingTone(finding)) {
    case "hit":
      return "destructive"
    case "inconclusive":
      return "outline"
    case "clear":
      return "secondary"
    default:
      return "outline"
  }
}

function toneLabel(finding: SecurityFinding, lang: AppLang) {
  switch (getSecurityFindingTone(finding)) {
    case "hit":
      return lang === "zh" ? "已命中" : "Match"
    case "inconclusive":
      return lang === "zh" ? "待确认" : "Inconclusive"
    case "clear":
      return lang === "zh" ? "未命中" : "Clear"
    default:
      return lang === "zh" ? "结果" : "Result"
  }
}

async function parseCheckResponse(response: Response) {
  const payload = await response.json().catch(() => null) as
    | { message?: string }
    | unknown

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}.`

    throw new Error(message)
  }

  return parseSecurityCheckPayload(payload)
}

function ExpandableMarkdownBlock({
  label,
  content,
  lang,
  expandLabel,
  collapseLabel,
}: ExpandableMarkdownBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const [measured, setMeasured] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const previewText = buildSummaryPreviewText(content)

  useEffect(() => {
    const element = previewRef.current

    if (!element) {
      return
    }

    setCanExpand(false)
    setMeasured(false)

    const measureOverflow = () => {
      const nextCanExpand = element.scrollHeight > element.clientHeight + 1
      setCanExpand((current) => current || nextCanExpand)
      setMeasured(true)
    }

    measureOverflow()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverflow)
      return () => window.removeEventListener("resize", measureOverflow)
    }

    const observer = new ResizeObserver(measureOverflow)
    observer.observe(element)
    window.addEventListener("resize", measureOverflow)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measureOverflow)
    }
  }, [previewText])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
          {label}
        </p>
        {canExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-zinc-500 hover:text-zinc-950 dark:text-stone-400 dark:hover:text-stone-50"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {expanded ? collapseLabel : expandLabel}
          </Button>
        ) : null}
      </div>
      <div className="rounded-2xl border border-black/6 bg-white/65 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none">
        {expanded || (measured && !canExpand) ? (
          <MarkdownRenderer
            content={content}
            variant="public"
            lang={lang}
            className="text-sm leading-6 text-zinc-600 dark:text-stone-300 [&_p]:text-inherit [&_ul]:text-inherit [&_ol]:text-inherit [&_.markdown-body]:text-inherit"
          />
        ) : (
          <div
            ref={previewRef}
            className="line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-stone-300"
          >
            {previewText}
          </div>
        )}
      </div>
    </div>
  )
}

export function PackageCheckWorkbench({ lang }: PackageCheckWorkbenchProps) {
  const copy = getUiText(lang)
  const [ecosystem, setEcosystem] = useState<SecurityPackageEcosystem>("npm")
  const [packageName, setPackageName] = useState("")
  const [version, setVersion] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PackageCheckWorkbenchResult | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setPending(true)
    setError(null)
    setResult(null)

    try {
      const payload = await parseCheckResponse(
        await fetch("/api/security/check/packages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            buildSecurityCheckRequestBody({
              ecosystem,
              name: packageName,
              version,
            }),
          ),
        }),
      )

      setResult(buildSecurityWorkbenchResultState(payload))
    } catch (submitError) {
      setResult(null)
      setError(
        submitError instanceof Error
          ? submitError.message
          : lang === "zh"
            ? "查询失败，请稍后再试。"
            : "The check failed. Please try again.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.35rem] border border-black/5 bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
        <form action="#" className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <p className="px-1 text-sm leading-6 text-zinc-600 dark:text-stone-300">
            {copy.publicCheckSearchHint}
          </p>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label htmlFor="security-ecosystem" className="sr-only">
              {lang === "zh" ? "生态" : "Ecosystem"}
            </label>
            <select
              id="security-ecosystem"
              className={cn(getAdminSelectClassName(), "h-11 min-w-[150px] rounded-full lg:w-[170px]")}
              value={ecosystem}
              onChange={(event) => setEcosystem(event.target.value as SecurityPackageEcosystem)}
              disabled={pending}
            >
              {SECURITY_PACKAGE_ECOSYSTEM_VALUES.map((option) => (
                <option key={option} value={option}>
                  {ecosystemLabel(option)}
                </option>
              ))}
            </select>
            <label htmlFor="security-package-name" className="sr-only">
              {copy.publicCheckPackageName}
            </label>
            <Input
              id="security-package-name"
              type="search"
              value={packageName}
              onChange={(event) => setPackageName(event.target.value)}
              placeholder={ecosystem === "npm" ? "@scope/package" : "package-name"}
              className="h-11 min-w-0 flex-1 rounded-full border-black/6 bg-[#fcfcfa] px-4 text-sm text-zinc-950 placeholder:text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus-visible:border-emerald-700/30 dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus-visible:border-emerald-200/30 dark:shadow-none"
              disabled={pending}
              required
            />
            <label htmlFor="security-package-version" className="sr-only">
              {copy.publicCheckVersion}
            </label>
            <Input
              id="security-package-version"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="1.0.0"
              className="h-11 rounded-full border-black/6 bg-[#fcfcfa] px-4 text-sm text-zinc-950 placeholder:text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus-visible:border-emerald-700/30 lg:w-[180px] dark:border-white/10 dark:bg-white/[0.055] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus-visible:border-emerald-200/30 dark:shadow-none"
              disabled={pending}
            />
            <Button
              type="submit"
              aria-label={pending ? copy.publicCheckSubmitting : copy.publicCheckSubmit}
              title={pending ? copy.publicCheckSubmitting : copy.publicCheckSubmit}
              disabled={pending || !packageName.trim()}
              className={cn(
                buttonVariants({ size: "icon", variant: "outline" }),
                "size-11 shrink-0 rounded-full border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-[#dcebe2] hover:text-emerald-950 dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.24)] dark:hover:bg-emerald-300/14 dark:hover:text-emerald-50",
              )}
            >
              <Search className="size-4" />
              <span className="sr-only">
                {pending ? copy.publicCheckSubmitting : copy.publicCheckSubmit}
              </span>
            </Button>
          </div>
        </form>
      </div>

      {error ? (
        <div
          className="rounded-[1.15rem] border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:bg-destructive/10 dark:shadow-none"
          aria-live="polite"
        >
          {error}
        </div>
      ) : null}

      {result?.warning ? (
        <div
          className="rounded-[1.15rem] border border-black/8 bg-white/75 px-4 py-3 text-sm text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:text-stone-200 dark:shadow-none"
          aria-live="polite"
        >
          {result.warning}
        </div>
      ) : null}

      {result ? result.empty ? (
        <section className={cn("space-y-2", getAdminSubtlePanelClassName())}>
          <p className="text-sm text-zinc-700 dark:text-stone-200">{copy.publicCheckNoFindings}</p>
        </section>
      ) : (
        <section className="space-y-3">
          {result.findings.map((finding, index) => {
            const formattedRanges = formatAffectedRanges(
              finding.affectedPackage.ranges,
            )

            return (
              <article
                key={`${finding.advisory.id}-${finding.package.name}-${index}`}
                className={cn("space-y-3", getAdminSubtlePanelClassName())}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                      {copy.publicCheckResultLabel}
                    </p>
                    <p className="text-sm font-medium text-zinc-950 dark:text-stone-50">
                      {finding.matchSummary}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-stone-400">
                      {finding.matchReason} · {finding.confidence}
                    </p>
                  </div>
                  <Badge variant={toneBadgeVariant(finding)}>{toneLabel(finding, lang)}</Badge>
                </div>

                {finding.advisory.summary ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                      {copy.publicCheckSummaryLabel}
                    </p>
                    <MarkdownSummary
                      content={finding.advisory.summary}
                      variant="public"
                      lang={lang}
                      className="text-sm leading-6 text-zinc-700 dark:text-stone-200 [&_p]:text-inherit [&_ul]:text-inherit [&_ol]:text-inherit"
                    />
                  </div>
                ) : null}

                {finding.advisory.details ? (
                  <div>
                    <ExpandableMarkdownBlock
                      label={copy.publicCheckDetailsLabel}
                      content={finding.advisory.details}
                      lang={lang}
                      expandLabel={copy.publicCheckDetailsToggle}
                      collapseLabel={copy.publicCheckDetailsCollapse}
                    />
                  </div>
                ) : null}

                {finding.affectedPackage.affectedVersions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                      {copy.publicCheckAffectedVersionsLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {finding.affectedPackage.affectedVersions.map((affectedVersion, affectedVersionIndex) => (
                        <Badge key={`${affectedVersion}-${affectedVersionIndex}`} variant="outline">
                          {affectedVersion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {formattedRanges.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                      {copy.publicCheckAffectedRangesLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {formattedRanges.map((rangeLabel, rangeIndex) => (
                        <Badge key={`${rangeLabel}-${rangeIndex}`} variant="outline">
                          {rangeLabel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {finding.affectedPackage.fixedVersions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                      {lang === "zh" ? "已知修复版本" : "Known fixed versions"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {finding.affectedPackage.fixedVersions.map((fixedVersion) => (
                        <Badge key={fixedVersion} variant="secondary">
                          {fixedVersion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {finding.advisory.references.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                      {lang === "zh" ? "参考链接" : "References"}
                    </p>
                    <ul className="space-y-1 text-xs text-zinc-500 dark:text-stone-400">
                      {finding.advisory.references.map((reference, referenceIndex) => (
                        <li key={`${reference.url}-${referenceIndex}`} className="break-all">
                          <a
                            href={reference.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-950 dark:decoration-white/20 dark:hover:text-stone-50"
                          >
                            {reference.type ? `${reference.type}: ` : ""}
                            {reference.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>
      ) : null}
    </div>
  )
}
